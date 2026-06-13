"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, LoadingBlock } from "../../components/ui";
import type { Category } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { AiSuggestionPanel } from "./ai-suggestion-panel";
import { AiPriceSuggestionPanel } from "./ai-price-suggestion-panel";
import {
  createListingRequest,
  requestListingSuggestion,
  requestPriceSuggestion,
  uploadListingImageRequest,
  type CreateListingRequest,
  type ListingSuggestion,
  type ListingSuggestionRequest,
  type PriceSuggestion,
  type PriceSuggestionRequest
} from "./api";
import type { ListingCondition, ListingType } from "./listing-form-options";
import { SellListingFields } from "./sell-listing-fields";

type SellListingFormProps = {
  categories: Category[];
  apiBaseUrl: string;
};

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_IMAGE_COUNT = 5;

export function SellListingForm({ categories, apiBaseUrl }: SellListingFormProps) {
  const { dictionary } = useI18n();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [priceAiErrorMessage, setPriceAiErrorMessage] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ListingSuggestion | null>(null);
  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSuggestingPrice, setIsSuggestingPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasCategories = categories.length > 0;
  const clearSelectedImages = useCallback(() => {
    setSelectedImages((currentImages) => {
      currentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  }, []);
  const clearProtectedState = useCallback(() => {
    setErrorMessage(null);
    setAiErrorMessage(null);
    setPriceAiErrorMessage(null);
    setSuggestion(null);
    setPriceSuggestion(null);
    clearSelectedImages();
    setIsSuggesting(false);
    setIsSuggestingPrice(false);
    setIsSubmitting(false);
  }, [clearSelectedImages]);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const payload = buildCreateListingPayload(new FormData(event.currentTarget));

    if (!payload) {
      setErrorMessage(dictionary.listings.requiredFields);
      return;
    }

    if (!(await requireAuth())) {
      return;
    }

    setIsSubmitting(true);

    try {
      if ((payload.imageUrls?.length ?? 0) + selectedImages.length > MAX_IMAGE_COUNT) {
        setErrorMessage(dictionary.listings.imageLimitHelp);
        return;
      }

      const body = await createListingRequest(apiBaseUrl, payload);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      for (const selectedImage of selectedImages) {
        const uploadBody = await uploadListingImageRequest(apiBaseUrl, body.data.listing.id, selectedImage.file);

        if (!uploadBody.ok) {
          setErrorMessage(getApiErrorMessage(uploadBody.error, dictionary, dictionary.listings.imageUploadFailed));
          return;
        }
      }

      clearSelectedImages();
      router.push(`/listings/${body.data.listing.id}`);
      router.refresh();
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => clearSelectedImages, [clearSelectedImages]);

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (selectedImages.length + files.length > MAX_IMAGE_COUNT) {
      setErrorMessage(dictionary.listings.imageLimitHelp);
      return;
    }

    setErrorMessage(null);
    setSelectedImages((currentImages) => [
      ...currentImages,
      ...files.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file)
      }))
    ]);
  }

  function removeSelectedImage(id: string) {
    setSelectedImages((currentImages) => {
      const image = currentImages.find((currentImage) => currentImage.id === id);

      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }

      return currentImages.filter((currentImage) => currentImage.id !== id);
    });
  }

  async function handleGenerateSuggestion(form: HTMLFormElement | null) {
    if (!form) {
      return;
    }

    setAiErrorMessage(null);
    const payload = buildSuggestionPayload(form);

    if (Object.keys(payload).length === 0) {
      setAiErrorMessage(dictionary.listings.aiNeedsDetails);
      return;
    }

    setIsSuggesting(true);

    try {
      const body = await requestListingSuggestion(apiBaseUrl, payload);

      if (!body.ok) {
        setAiErrorMessage(getApiErrorMessage(body.error, dictionary, dictionary.listings.aiUnavailableManual));
        return;
      }

      setSuggestion(body.data.suggestion);
      fillSuggestionFields(form, body.data.suggestion);
    } catch {
      setAiErrorMessage(dictionary.listings.aiUnavailableManual);
    } finally {
      setIsSuggesting(false);
    }
  }

  async function handleGeneratePriceSuggestion(form: HTMLFormElement | null) {
    if (!form) {
      return;
    }

    setPriceAiErrorMessage(null);
    const payload = buildPriceSuggestionPayload(form);

    if (Object.keys(payload).length === 0) {
      setPriceAiErrorMessage("Add category, condition, listing type, title, or a current price first.");
      return;
    }

    setIsSuggestingPrice(true);

    try {
      const body = await requestPriceSuggestion(apiBaseUrl, payload);

      if (!body.ok) {
        setPriceAiErrorMessage(getApiErrorMessage(body.error, dictionary, "AI price suggestion is unavailable. You can continue manually."));
        return;
      }

      setPriceSuggestion(body.data.suggestion);
    } catch {
      setPriceAiErrorMessage("AI price suggestion is unavailable. You can continue manually.");
    } finally {
      setIsSuggestingPrice(false);
    }
  }

  if (isCheckingAuth) {
    return <LoadingBlock title={dictionary.common.loading} />;
  }

  return (
    <form className="listing-form" onSubmit={handleSubmit}>
      <SellListingFields categories={categories} />

      <section className="image-upload-panel" aria-label={dictionary.listings.images}>
        <div>
          <label className="file-upload-label">
            <span>{dictionary.listings.uploadImage}</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              disabled={isSubmitting || selectedImages.length >= MAX_IMAGE_COUNT}
              multiple
              type="file"
              onChange={handleImageSelection}
            />
          </label>
          <p className="muted">{dictionary.listings.imageLimitHelp}</p>
        </div>

        {selectedImages.length > 0 ? (
          <ul className="image-preview-list">
            {selectedImages.map((image) => (
              <li key={image.id}>
                <img src={image.previewUrl} alt="" />
                <span>{image.file.name}</span>
                <Button
                  variant="ghost"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => removeSelectedImage(image.id)}
                >
                  {dictionary.listings.deleteImage}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {errorMessage ? (
        <Alert title={dictionary.listings.createFailed} message={errorMessage} />
      ) : null}

      {aiErrorMessage ? (
        <Alert title={dictionary.listings.aiSuggestionUnavailable} message={aiErrorMessage} />
      ) : null}

      {priceAiErrorMessage ? (
        <Alert title="AI price suggestion unavailable" message={priceAiErrorMessage} />
      ) : null}

      {suggestion ? <AiSuggestionPanel suggestion={suggestion} /> : null}

      {priceSuggestion ? (
        <AiPriceSuggestionPanel
          suggestion={priceSuggestion}
          onApplyPrice={() => {
            const form = document.forms[0];

            if (form) {
              fillPriceSuggestionFields(form, priceSuggestion);
            }
          }}
        />
      ) : null}

      <div className="form-actions">
        <p className="form-note">{dictionary.listings.formTrustNote}</p>
        <div className="form-button-row">
          <Button
            variant="secondary"
            type="button"
            disabled={isSuggesting}
            onClick={(event) => {
              void handleGenerateSuggestion(event.currentTarget.form);
            }}
          >
            {isSuggesting ? dictionary.listings.suggesting : dictionary.listings.suggestListingDetails}
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={isSuggestingPrice}
            onClick={(event) => {
              void handleGeneratePriceSuggestion(event.currentTarget.form);
            }}
          >
            {isSuggestingPrice ? "Suggesting price..." : "Suggest price"}
          </Button>
          <Button type="submit" disabled={isSubmitting || !hasCategories}>
            {isSubmitting ? dictionary.listings.creating : dictionary.common.createListing}
          </Button>
        </div>
      </div>
    </form>
  );
}

function buildCreateListingPayload(formData: FormData): CreateListingRequest | null {
  const categoryId = getString(formData, "categoryId");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const priceAmount = getString(formData, "priceAmount");
  const currency = getString(formData, "currency").toUpperCase() || "TRY";
  const listingType = getString(formData, "listingType") as ListingType;
  const condition = getString(formData, "condition") as ListingCondition;
  const imageUrls = getString(formData, "imageUrls")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!categoryId || !title || !listingType || !condition) {
    return null;
  }

  return {
    categoryId,
    title,
    currency,
    listingType,
    condition,
    ...(description ? { description } : {}),
    ...(priceAmount ? { priceAmount } : {}),
    ...(imageUrls.length > 0 ? { imageUrls } : {})
  };
}

function buildSuggestionPayload(form: HTMLFormElement): ListingSuggestionRequest {
  const formData = new FormData(form);
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const categoryName = getSelectedOptionText(form, "categoryId");
  const condition = getString(formData, "condition");

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(categoryName ? { categoryName } : {}),
    ...(condition ? { condition } : {})
  };
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getSelectedOptionText(form: HTMLFormElement, key: string): string {
  const field = form.elements.namedItem(key);

  if (!(field instanceof HTMLSelectElement)) {
    return "";
  }

  return field.selectedOptions[0]?.textContent?.trim() ?? "";
}

function fillSuggestionFields(form: HTMLFormElement, suggestion: ListingSuggestion): void {
  const titleField = form.elements.namedItem("title");
  const descriptionField = form.elements.namedItem("description");

  if (titleField instanceof HTMLInputElement) {
    titleField.value = suggestion.suggestedTitle;
  }

  if (descriptionField instanceof HTMLTextAreaElement) {
    descriptionField.value = suggestion.suggestedDescription;
  }
}


function buildPriceSuggestionPayload(form: HTMLFormElement): PriceSuggestionRequest {
  const formData = new FormData(form);
  const title = getString(formData, "title");
  const categoryName = getSelectedOptionText(form, "categoryId");
  const condition = getString(formData, "condition");
  const listingType = getString(formData, "listingType") as ListingType;
  const currentPriceAmount = getString(formData, "priceAmount");
  const currency = getString(formData, "currency").toUpperCase() || "TRY";

  return {
    ...(title ? { title } : {}),
    ...(categoryName ? { categoryName } : {}),
    ...(condition ? { condition } : {}),
    ...(listingType ? { listingType } : {}),
    ...(currentPriceAmount ? { currentPriceAmount } : {}),
    currency
  };
}


function fillPriceSuggestionFields(form: HTMLFormElement, suggestion: PriceSuggestion): void {
  const priceField = form.elements.namedItem("priceAmount");
  const currencyField = form.elements.namedItem("currency");

  if (priceField instanceof HTMLInputElement && suggestion.recommendedPriceAmount) {
    priceField.value = suggestion.recommendedPriceAmount;
  }

  if (currencyField instanceof HTMLInputElement) {
    currencyField.value = suggestion.currency;
  }
}

"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";
import { Alert, Button, LoadingBlock } from "../../components/ui";
import type { Category } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { AiSuggestionPanel } from "./ai-suggestion-panel";
import {
  createListingRequest,
  requestListingSuggestion,
  type CreateListingRequest,
  type ListingSuggestion,
  type ListingSuggestionRequest
} from "./api";
import type { ListingCondition, ListingType } from "./listing-form-options";
import { SellListingFields } from "./sell-listing-fields";

type SellListingFormProps = {
  categories: Category[];
  apiBaseUrl: string;
};

export function SellListingForm({ categories, apiBaseUrl }: SellListingFormProps) {
  const { dictionary } = useI18n();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ListingSuggestion | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasCategories = categories.length > 0;
  const clearProtectedState = useCallback(() => {
    setErrorMessage(null);
    setAiErrorMessage(null);
    setSuggestion(null);
    setIsSuggesting(false);
    setIsSubmitting(false);
  }, []);
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
      const body = await createListingRequest(apiBaseUrl, payload);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      router.push(`/listings/${body.data.listing.id}`);
      router.refresh();
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
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

  if (isCheckingAuth) {
    return <LoadingBlock title={dictionary.common.loading} />;
  }

  return (
    <form className="listing-form" onSubmit={handleSubmit}>
      <SellListingFields categories={categories} />

      {errorMessage ? (
        <Alert title={dictionary.listings.createFailed} message={errorMessage} />
      ) : null}

      {aiErrorMessage ? (
        <Alert title={dictionary.listings.aiSuggestionUnavailable} message={aiErrorMessage} />
      ) : null}

      {suggestion ? <AiSuggestionPanel suggestion={suggestion} /> : null}

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

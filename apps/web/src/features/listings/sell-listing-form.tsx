"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { getAuthToken } from "../../lib/auth-client";
import type { Category } from "../../lib/api";
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
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ListingSuggestion | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasCategories = categories.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const payload = buildCreateListingPayload(new FormData(event.currentTarget));

    if (!payload) {
      setErrorMessage("Please complete the required fields.");
      return;
    }

    if (!getAuthToken()) {
      setErrorMessage("Please log in before creating a listing.");
      return;
    }

    setIsSubmitting(true);

    try {
      const body = await createListingRequest(apiBaseUrl, payload);

      if (!body.ok) {
        setErrorMessage(body.error.message);
        return;
      }

      router.push(`/listings/${body.data.listing.id}`);
      router.refresh();
    } catch {
      setErrorMessage("BabyLoop API is unavailable.");
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
      setAiErrorMessage("Add at least one listing detail before requesting a suggestion.");
      return;
    }

    setIsSuggesting(true);

    try {
      const body = await requestListingSuggestion(apiBaseUrl, payload);

      if (!body.ok) {
        setAiErrorMessage(body.error.message);
        return;
      }

      setSuggestion(body.data.suggestion);
      fillSuggestionFields(form, body.data.suggestion);
    } catch {
      setAiErrorMessage("AI suggestion is unavailable. You can continue manually.");
    } finally {
      setIsSuggesting(false);
    }
  }

  return (
    <form className="listing-form" onSubmit={handleSubmit}>
      <SellListingFields categories={categories} />

      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {aiErrorMessage ? (
        <p className="form-error" role="status">
          {aiErrorMessage}
        </p>
      ) : null}

      {suggestion ? <AiSuggestionPanel suggestion={suggestion} /> : null}

      <div className="form-actions">
        <p className="form-note">Seller profile comes from your login token.</p>
        <div className="form-button-row">
          <button
            className="secondary-button"
            type="button"
            disabled={isSuggesting}
            onClick={(event) => {
              void handleGenerateSuggestion(event.currentTarget.form);
            }}
          >
            {isSuggesting ? "Generating..." : "Generate with AI"}
          </button>
          <button
            className="submit-button"
            type="submit"
            disabled={isSubmitting || !hasCategories}
          >
            {isSubmitting ? "Creating..." : "Create listing"}
          </button>
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


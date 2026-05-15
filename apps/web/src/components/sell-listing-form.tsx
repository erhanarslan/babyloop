"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse } from "@babyloop/shared";
import { authHeader, getAuthToken } from "../lib/auth-client";
import type { Category, ListingSummary } from "../lib/api";

const listingTypes = [
  { value: "sale", label: "For sale" },
  { value: "swap", label: "Swap" },
  { value: "donation", label: "Donation" },
  { value: "rent", label: "Rent" }
] as const;

const conditions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "needs_repair", label: "Needs repair" }
] as const;

type ListingType = (typeof listingTypes)[number]["value"];
type ListingCondition = (typeof conditions)[number]["value"];

type CreateListingRequest = {
  categoryId: string;
  title: string;
  description?: string;
  priceAmount?: string;
  currency?: string;
  listingType: ListingType;
  condition: ListingCondition;
  imageUrls?: string[];
};

type CreateListingPayload = {
  listing: ListingSummary;
};

type ListingSuggestionRequest = {
  title?: string;
  description?: string;
  categoryName?: string;
  condition?: string;
};

type ListingSuggestion = {
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedTags: string[];
  missingInfoQuestions: string[];
  confidenceScore: number;
  providerName: string;
  promptVersion: string;
};

type ListingSuggestionPayload = {
  suggestion: ListingSuggestion;
};

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
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
      setErrorMessage("Please complete the required fields.");
      return;
    }

    const payload: CreateListingRequest = {
      categoryId,
      title,
      currency,
      listingType,
      condition,
      ...(description ? { description } : {}),
      ...(priceAmount ? { priceAmount } : {}),
      ...(imageUrls.length > 0 ? { imageUrls } : {})
    };
    const token = getAuthToken();

    if (!token) {
      setErrorMessage("Please log in before creating a listing.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/listings`, {
        method: "POST",
        headers: {
          ...authHeader(),
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as ApiResponse<CreateListingPayload>;

      if (!response.ok || !body.ok) {
        const message = body.ok ? "Listing could not be created." : body.error.message;
        setErrorMessage(message);
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

    const formData = new FormData(form);
    const title = getString(formData, "title");
    const description = getString(formData, "description");
    const categoryName = getSelectedOptionText(form, "categoryId");
    const condition = getString(formData, "condition");
    const payload: ListingSuggestionRequest = {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(categoryName ? { categoryName } : {}),
      ...(condition ? { condition } : {})
    };

    if (Object.keys(payload).length === 0) {
      setAiErrorMessage("Add at least one listing detail before requesting a suggestion.");
      return;
    }

    setIsSuggesting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/ai/listing-suggestions`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as ApiResponse<ListingSuggestionPayload>;

      if (!response.ok || !body.ok) {
        const message = body.ok ? "AI suggestion could not be generated." : body.error.message;
        setAiErrorMessage(message);
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

  const hasCategories = categories.length > 0;

  return (
    <form className="listing-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          <span>Category</span>
          <select name="categoryId" required disabled={!hasCategories}>
            {hasCategories ? (
              categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))
            ) : (
              <option value="">No categories available</option>
            )}
          </select>
        </label>

        <label className="form-field">
          <span>Listing type</span>
          <select name="listingType" defaultValue="sale" required>
            {listingTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field form-field-wide">
          <span>Title</span>
          <input
            name="title"
            type="text"
            minLength={4}
            maxLength={160}
            required
            placeholder="Stokke stroller in good condition"
          />
        </label>

        <label className="form-field form-field-wide">
          <span>Description</span>
          <textarea
            name="description"
            maxLength={2000}
            rows={5}
            placeholder="Add condition notes, included pieces, and pickup details."
          />
        </label>

        <label className="form-field">
          <span>Price amount</span>
          <input name="priceAmount" type="text" inputMode="decimal" placeholder="6500.00" />
        </label>

        <label className="form-field">
          <span>Currency</span>
          <input name="currency" type="text" defaultValue="TRY" maxLength={3} required />
        </label>

        <label className="form-field">
          <span>Condition</span>
          <select name="condition" defaultValue="good" required>
            {conditions.map((conditionOption) => (
              <option key={conditionOption.value} value={conditionOption.value}>
                {conditionOption.label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field form-field-wide">
          <span>Image URLs</span>
          <textarea
            name="imageUrls"
            rows={3}
            placeholder="https://example.com/stroller-front.jpg"
          />
        </label>
      </div>

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

      {suggestion ? <SuggestionPanel suggestion={suggestion} /> : null}

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

function SuggestionPanel({ suggestion }: { suggestion: ListingSuggestion }) {
  return (
    <section className="ai-suggestion-panel" aria-label="AI listing suggestion">
      <div>
        <h2>AI suggestion</h2>
        <p>{suggestion.suggestedDescription}</p>
      </div>

      <div className="tag-list" aria-label="Suggested tags">
        {suggestion.suggestedTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      {suggestion.missingInfoQuestions.length > 0 ? (
        <ul className="question-list">
          {suggestion.missingInfoQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      ) : null}

      <p className="ai-debug">
        {suggestion.providerName} · {suggestion.promptVersion} · confidence{" "}
        {suggestion.confidenceScore}
      </p>
    </section>
  );
}

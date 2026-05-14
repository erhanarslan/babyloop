"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse } from "@babyloop/shared";
import type { Category, ListingSummary } from "../lib/api";

const LOCAL_DEV_SELLER_PROFILE_ID = "10000000-0000-4000-8000-000000000001";

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
  seller_profile_id: string;
  category_id: string;
  title: string;
  description?: string;
  price_amount?: string;
  currency?: string;
  listing_type: ListingType;
  condition: ListingCondition;
  image_urls?: string[];
};

type CreateListingPayload = {
  listing: ListingSummary;
};

type SellListingFormProps = {
  categories: Category[];
  apiBaseUrl: string;
};

export function SellListingForm({ categories, apiBaseUrl }: SellListingFormProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const categoryId = getString(formData, "category_id");
    const title = getString(formData, "title");
    const description = getString(formData, "description");
    const priceAmount = getString(formData, "price_amount");
    const currency = getString(formData, "currency").toUpperCase() || "TRY";
    const listingType = getString(formData, "listing_type") as ListingType;
    const condition = getString(formData, "condition") as ListingCondition;
    const imageUrls = getString(formData, "image_urls")
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!categoryId || !title || !listingType || !condition) {
      setErrorMessage("Please complete the required fields.");
      return;
    }

    const payload: CreateListingRequest = {
      seller_profile_id: LOCAL_DEV_SELLER_PROFILE_ID,
      category_id: categoryId,
      title,
      currency,
      listing_type: listingType,
      condition,
      ...(description ? { description } : {}),
      ...(priceAmount ? { price_amount: priceAmount } : {}),
      ...(imageUrls.length > 0 ? { image_urls: imageUrls } : {})
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/listings`, {
        method: "POST",
        headers: {
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

  const hasCategories = categories.length > 0;

  return (
    <form className="listing-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          <span>Category</span>
          <select name="category_id" required disabled={!hasCategories}>
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
          <select name="listing_type" defaultValue="sale" required>
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
          <input name="price_amount" type="text" inputMode="decimal" placeholder="6500.00" />
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
            name="image_urls"
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

      <div className="form-actions">
        <p className="form-note">Local dev seller: Ayse Demir</p>
        <button className="submit-button" type="submit" disabled={isSubmitting || !hasCategories}>
          {isSubmitting ? "Creating..." : "Create listing"}
        </button>
      </div>
    </form>
  );
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

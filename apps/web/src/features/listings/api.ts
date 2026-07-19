"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authFetch } from "../../lib/auth-client";
import type { ListingSummary } from "../../lib/api";
import type { ListingCondition, ListingType } from "./listing-form-options";

export type CreateListingRequest = {
  categoryId: string;
  title: string;
  description?: string;
  priceAmount?: string;
  currency?: string;
  listingType: ListingType;
  condition: ListingCondition;
  recommendedAgeMinMonths?: number | null;
  recommendedAgeMaxMonths?: number | null;
};

export type ListingLifecycleStatus = "draft" | "active" | "reserved" | "sold" | "archived";

export type UpdateListingRequest = Partial<{
  title: string;
  description: string;
  priceAmount: string;
  currency: string;
  listingType: ListingType;
  condition: ListingCondition;
  recommendedAgeMinMonths: number | null;
  recommendedAgeMaxMonths: number | null;
}>;

export type CreateListingPayload = {
  listing: ListingSummary;
};

export type ListingImagePayload = {
  image: ListingSummary["firstImage"] & {
    reviewStatus?: "pending" | "approved" | "needs_review" | "rejected";
  };
};

export type MyListingsPayload = {
  listings: ListingSummary[];
};

export type ListingSuggestionRequest = {
  title?: string;
  description?: string;
  categoryName?: string;
  condition?: string;
  listingType?: "sale" | "swap" | "donation";
};

export type ListingSuggestion = {
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedCategorySlug: string | null;
  suggestedCategoryName: string | null;
  suggestedCondition: string | null;
  suggestedListingType: "sale" | "swap" | "donation";
  suggestedTags: string[];
  safetyWarnings: string[];
  missingInfoQuestions: string[];
  confidenceScore: number;
  providerName: string;
  promptVersion: string;
};

export type PriceSuggestionRequest = {
  title?: string;
  categoryName?: string;
  condition?: string;
  listingType?: ListingType;
  currentPriceAmount?: string;
  currency?: string;
};

export type PriceSuggestion = {
  recommendedPriceAmount: string | null;
  recommendedPriceMin: string | null;
  recommendedPriceMax: string | null;
  currency: string;
  pricingMode: "suggested" | "not_applicable";
  rationale: string[];
  confidenceScore: number;
  providerName: string;
  promptVersion: string;
};

type ListingSuggestionPayload = {
  suggestion: ListingSuggestion;
};

type PriceSuggestionPayload = {
  suggestion: PriceSuggestion;
};

export type AiListingDraftSuggestionConfidence = "low" | "medium" | "high";

export type AiListingDraftSuggestion = {
  title?: string;
  description?: string;
  categoryId?: string;
  condition?: ListingCondition;
  priceSuggestion?: {
    min: number;
    max: number;
    currency: "TRY";
    confidence: AiListingDraftSuggestionConfidence;
    reason: string;
  };
  imageFeedback: Array<{
    imageIdOrUrl: string;
    status: "good" | "unclear" | "possibly_irrelevant" | "needs_review";
    message: string;
  }>;
  missingDetails: string[];
  warnings: string[];
  confidence: AiListingDraftSuggestionConfidence;
  providerName: string;
  promptVersion: string;
  modelName?: string;
};

type AiListingDraftSuggestionPayload = {
  suggestion: AiListingDraftSuggestion;
};

export async function createListingRequest(
  apiBaseUrl: string,
  payload: CreateListingRequest
): Promise<ApiResponse<CreateListingPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/listings", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<ApiResponse<CreateListingPayload>>;
}

export async function fetchMyListings(apiBaseUrl: string): Promise<ApiResponse<MyListingsPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/me/listings");

  return response.json() as Promise<ApiResponse<MyListingsPayload>>;
}

export async function updateListingRequest(
  apiBaseUrl: string,
  listingId: string,
  payload: UpdateListingRequest
): Promise<ApiResponse<CreateListingPayload>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/listings/${listingId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<ApiResponse<CreateListingPayload>>;
}

export async function updateListingStatusRequest(
  apiBaseUrl: string,
  listingId: string,
  status: ListingLifecycleStatus
): Promise<ApiResponse<CreateListingPayload>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/listings/${listingId}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ status })
  });

  return response.json() as Promise<ApiResponse<CreateListingPayload>>;
}

export async function uploadListingImageRequest(
  apiBaseUrl: string,
  listingId: string,
  file: File
): Promise<ApiResponse<ListingImagePayload>> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await authFetch(apiBaseUrl, `/api/v1/listings/${listingId}/images`, {
    method: "POST",
    body: formData
  });

  return response.json() as Promise<ApiResponse<ListingImagePayload>>;
}

export async function deleteListingImageRequest(
  apiBaseUrl: string,
  listingId: string,
  imageId: string
): Promise<ApiResponse<{ deleted: true }>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/listings/${listingId}/images/${imageId}`, {
    method: "DELETE"
  });

  return response.json() as Promise<ApiResponse<{ deleted: true }>>;
}

export async function requestListingSuggestion(
  apiBaseUrl: string,
  payload: ListingSuggestionRequest
): Promise<ApiResponse<ListingSuggestionPayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/ai/listing-suggestions`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<ApiResponse<ListingSuggestionPayload>>;
}

export async function requestPriceSuggestion(
  apiBaseUrl: string,
  payload: PriceSuggestionRequest
): Promise<ApiResponse<PriceSuggestionPayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/ai/price-suggestions`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<ApiResponse<PriceSuggestionPayload>>;
}

export async function requestListingDraftSuggestion(
  apiBaseUrl: string,
  formData: FormData
): Promise<ApiResponse<AiListingDraftSuggestionPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/listings/ai-draft-suggestions", {
    method: "POST",
    body: formData
  });

  return response.json() as Promise<ApiResponse<AiListingDraftSuggestionPayload>>;
}

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
  imageUrls?: string[];
};

export type ListingLifecycleStatus = "active" | "reserved" | "sold" | "archived";

export type UpdateListingRequest = Partial<{
  title: string;
  description: string;
  priceAmount: string;
  currency: string;
  listingType: ListingType;
  condition: ListingCondition;
  imageUrls: string[];
}>;

export type CreateListingPayload = {
  listing: ListingSummary;
};

export type MyListingsPayload = {
  listings: ListingSummary[];
};

export type ListingSuggestionRequest = {
  title?: string;
  description?: string;
  categoryName?: string;
  condition?: string;
};

export type ListingSuggestion = {
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

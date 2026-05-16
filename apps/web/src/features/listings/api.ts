"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authHeader } from "../../lib/auth-client";
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

export type CreateListingPayload = {
  listing: ListingSummary;
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
  const response = await fetch(`${apiBaseUrl}/api/v1/listings`, {
    method: "POST",
    headers: {
      ...authHeader(),
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
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


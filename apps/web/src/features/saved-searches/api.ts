"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authFetch } from "../../lib/auth-client";

export type SavedSearch = {
  id: string;
  name: string;
  q: string;
  city: string | null;
  categoryId: string | null;
  listingType: string | null;
  condition: string | null;
  priceMin: string | null;
  priceMax: string | null;
  hasImages: boolean;
  sort: string;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchPayload = {
  savedSearch: SavedSearch;
};

export type SavedSearchesPayload = {
  savedSearches: SavedSearch[];
};

export type CreateSavedSearchPayload = {
  name: string;
  q?: string;
  city?: string;
  categoryId?: string;
  listingType?: string;
  condition?: string;
  priceMin?: string;
  priceMax?: string;
  hasImages?: boolean;
  sort?: string;
  notificationsEnabled?: boolean;
};

export async function createSavedSearch(
  apiBaseUrl: string,
  payload: CreateSavedSearchPayload
): Promise<ApiResponse<SavedSearchPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/saved-searches", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<ApiResponse<SavedSearchPayload>>;
}

export async function fetchSavedSearches(
  apiBaseUrl: string
): Promise<ApiResponse<SavedSearchesPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/saved-searches");

  return response.json() as Promise<ApiResponse<SavedSearchesPayload>>;
}

export async function deleteSavedSearch(
  apiBaseUrl: string,
  savedSearchId: string
): Promise<ApiResponse<{ deleted: true }>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/saved-searches/${savedSearchId}`, {
    method: "DELETE"
  });

  return response.json() as Promise<ApiResponse<{ deleted: true }>>;
}


export async function updateSavedSearchNotifications(
  apiBaseUrl: string,
  savedSearchId: string,
  notificationsEnabled: boolean
): Promise<ApiResponse<SavedSearchPayload>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/saved-searches/${savedSearchId}/notifications`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ notificationsEnabled })
  });

  return response.json() as Promise<ApiResponse<SavedSearchPayload>>;
}

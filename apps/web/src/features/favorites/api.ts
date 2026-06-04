"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authFetch } from "../../lib/auth-client";
import type { FavoritesPayload } from "../../lib/api";

type FavoriteActionPayload = {
  favorite: {
    profileId: string;
    listingId: string;
  };
  created?: boolean;
  removed?: boolean;
};

export async function fetchFavorites(apiBaseUrl: string): Promise<ApiResponse<FavoritesPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/favorites");

  return response.json() as Promise<ApiResponse<FavoritesPayload>>;
}

export async function saveFavorite(
  apiBaseUrl: string,
  listingId: string,
  isFavorited: boolean
): Promise<ApiResponse<FavoriteActionPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/favorites", {
    method: isFavorited ? "DELETE" : "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      listingId
    })
  });

  return response.json() as Promise<ApiResponse<FavoriteActionPayload>>;
}

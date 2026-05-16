"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authHeader } from "../../lib/auth-client";
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
  const response = await fetch(`${apiBaseUrl}/api/v1/favorites`, {
    headers: authHeader()
  });

  return response.json() as Promise<ApiResponse<FavoritesPayload>>;
}

export async function saveFavorite(
  apiBaseUrl: string,
  listingId: string,
  isFavorited: boolean
): Promise<ApiResponse<FavoriteActionPayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/favorites`, {
    method: isFavorited ? "DELETE" : "POST",
    headers: {
      ...authHeader(),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      listing_id: listingId
    })
  });

  return response.json() as Promise<ApiResponse<FavoriteActionPayload>>;
}


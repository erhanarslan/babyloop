"use client";

import { useEffect, useState } from "react";
import type { ApiResponse } from "@babyloop/shared";
import { authHeader, getAuthToken, type AuthMe } from "../lib/auth-client";
import type { FavoritesPayload } from "../lib/api";

type FavoriteActionPayload = {
  favorite: {
    profileId: string;
    listingId: string;
  };
  created?: boolean;
  removed?: boolean;
};

type FavoriteButtonProps = {
  apiBaseUrl: string;
  listingId: string;
  initiallyFavorited: boolean;
};

export function FavoriteButton({
  apiBaseUrl,
  listingId,
  initiallyFavorited
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initiallyFavorited);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadFavoriteState() {
      const token = getAuthToken();

      if (!token) {
        setIsFavorited(false);
        return;
      }

      try {
        const meResponse = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
          headers: authHeader()
        });
        const meBody = (await meResponse.json()) as ApiResponse<AuthMe>;

        if (!meResponse.ok || !meBody.ok) {
          return;
        }

        const favoritesResponse = await fetch(
          `${apiBaseUrl}/api/v1/profiles/${meBody.data.profile.id}/favorites`,
          {
            headers: authHeader()
          }
        );
        const favoritesBody = (await favoritesResponse.json()) as ApiResponse<FavoritesPayload>;

        if (isActive && favoritesResponse.ok && favoritesBody.ok) {
          setIsFavorited(
            favoritesBody.data.favorites.some((favorite) => favorite.id === listingId)
          );
        }
      } catch {
        if (isActive) {
          setIsFavorited(false);
        }
      }
    }

    void loadFavoriteState();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, listingId]);

  async function handleClick() {
    setIsPending(true);
    setErrorMessage(null);
    const token = getAuthToken();

    if (!token) {
      setErrorMessage("Please log in before saving favorites.");
      setIsPending(false);
      return;
    }

    try {
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
      const body = (await response.json()) as ApiResponse<FavoriteActionPayload>;

      if (!response.ok || !body.ok) {
        setErrorMessage(body.ok ? "Favorite request failed." : body.error.message);
        return;
      }

      setIsFavorited(!isFavorited);
    } catch {
      setErrorMessage("BabyLoop API is unavailable.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="favorite-action">
      <button
        className={isFavorited ? "secondary-button" : "submit-button"}
        disabled={isPending}
        type="button"
        onClick={handleClick}
      >
        {isPending ? "Saving..." : isFavorited ? "Unfavorite" : "Favorite"}
      </button>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getAuthToken } from "../../lib/auth-client";
import { fetchFavorites, saveFavorite } from "./api";

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
      if (!getAuthToken()) {
        setIsFavorited(false);
        return;
      }

      try {
        const body = await fetchFavorites(apiBaseUrl);

        if (isActive && body.ok) {
          setIsFavorited(body.data.favorites.some((favorite) => favorite.id === listingId));
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

    if (!getAuthToken()) {
      setErrorMessage("Please log in before saving favorites.");
      setIsPending(false);
      return;
    }

    try {
      const body = await saveFavorite(apiBaseUrl, listingId, isFavorited);

      if (!body.ok) {
        setErrorMessage(body.error.message);
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


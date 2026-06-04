"use client";

import { useEffect, useState } from "react";
import { Alert, Button } from "../../components/ui";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
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
      if (!(await getOrRefreshAuthToken(apiBaseUrl))) {
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

    if (!(await getOrRefreshAuthToken(apiBaseUrl))) {
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
      <Button
        variant={isFavorited ? "secondary" : "primary"}
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? "Saving..." : isFavorited ? "Unfavorite" : "Favorite"}
      </Button>
      {errorMessage ? <Alert title="Favorite action failed" message={errorMessage} /> : null}
    </div>
  );
}

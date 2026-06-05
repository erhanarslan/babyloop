"use client";

import { useEffect, useState } from "react";
import { Alert, Button } from "../../components/ui";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
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
  const { dictionary } = useI18n();
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
      setErrorMessage(dictionary.marketplace.favoriteLoginRequired);
      setIsPending(false);
      return;
    }

    try {
      const body = await saveFavorite(apiBaseUrl, listingId, isFavorited);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setIsFavorited(!isFavorited);
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
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
        {isPending
          ? dictionary.marketplace.savingFavorite
          : isFavorited
            ? dictionary.marketplace.unfavorite
            : dictionary.marketplace.favorite}
      </Button>
      {errorMessage ? (
        <Alert title={dictionary.marketplace.favoriteActionFailed} message={errorMessage} />
      ) : null}
    </div>
  );
}

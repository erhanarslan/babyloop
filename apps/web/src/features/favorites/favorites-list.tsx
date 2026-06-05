"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, LoadingBlock } from "../../components/ui";
import type { FavoriteListing } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchFavorites } from "./api";
import { FavoriteCard } from "./favorite-card";

type FavoritesListProps = {
  apiBaseUrl: string;
};

export function FavoritesList({ apiBaseUrl }: FavoritesListProps) {
  const { dictionary } = useI18n();
  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const clearProtectedState = useCallback(() => {
    setFavorites([]);
    setMessage(null);
    setIsLoading(false);
  }, []);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  useEffect(() => {
    let isActive = true;

    async function loadFavorites() {
      if (!(await requireAuth())) {
        return;
      }

      try {
        const body = await fetchFavorites(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          setMessage(getApiErrorMessage(body.error, dictionary));
          return;
        }

        setFavorites(body.data.favorites);
      } catch {
        if (isActive) {
          setMessage(dictionary.common.apiUnavailable);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadFavorites();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary.common.apiUnavailable, requireAuth]);

  if (isCheckingAuth || isLoading) {
    return <LoadingBlock title={dictionary.marketplace.loadingFavorites} />;
  }

  if (message) {
    return (
      <EmptyState
        title={dictionary.marketplace.favoritesUnavailable}
        message={message}
        actionHref="/login"
        actionLabel={dictionary.common.login}
      />
    );
  }

  if (favorites.length === 0) {
    return (
      <EmptyState
        title={dictionary.marketplace.favoritesEmptyTitle}
        message={dictionary.marketplace.favoritesEmptyBody}
        actionHref="/browse"
        actionLabel={dictionary.common.browseMarketplace}
      />
    );
  }

  return (
    <div className="listing-grid">
      {favorites.map((favorite) => (
        <FavoriteCard favorite={favorite} key={favorite.id} />
      ))}
    </div>
  );
}

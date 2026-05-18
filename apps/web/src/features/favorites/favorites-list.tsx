"use client";

import { useEffect, useState } from "react";
import { EmptyState, LoadingBlock } from "../../components/ui";
import { getAuthToken } from "../../lib/auth-client";
import type { FavoriteListing } from "../../lib/api";
import { fetchFavorites } from "./api";
import { FavoriteCard } from "./favorite-card";

type FavoritesListProps = {
  apiBaseUrl: string;
};

export function FavoritesList({ apiBaseUrl }: FavoritesListProps) {
  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadFavorites() {
      if (!getAuthToken()) {
        setIsLoading(false);
        setMessage("Please log in to view your saved listings.");
        return;
      }

      try {
        const body = await fetchFavorites(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          setMessage(body.error.message);
          return;
        }

        setFavorites(body.data.favorites);
      } catch {
        if (isActive) {
          setMessage("BabyLoop API is unavailable.");
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
  }, [apiBaseUrl]);

  if (isLoading) {
    return <LoadingBlock title="Loading saved listings" />;
  }

  if (message) {
    return (
      <EmptyState title="Favorites unavailable" message={message} actionHref="/login" actionLabel="Login" />
    );
  }

  if (favorites.length === 0) {
    return (
      <EmptyState
        title="No saved listings yet."
        message="Open a listing detail page and save it with your logged-in account."
        actionHref="/browse"
        actionLabel="Browse listings"
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

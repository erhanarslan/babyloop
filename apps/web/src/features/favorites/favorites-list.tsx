"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
    return (
      <div className="empty-state">
        <h2>Loading saved listings</h2>
      </div>
    );
  }

  if (message) {
    return (
      <div className="empty-state">
        <h2>Favorites unavailable</h2>
        <p>{message}</p>
        <Link className="primary-link" href="/login">
          Login
        </Link>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="empty-state">
        <h2>No saved listings yet.</h2>
        <p>Open a listing detail page and save it with your logged-in account.</p>
        <Link className="primary-link" href="/browse">
          Browse listings
        </Link>
      </div>
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


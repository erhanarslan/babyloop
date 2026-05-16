"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authHeader, getAuthToken } from "../lib/auth-client";
import type { FavoriteListing, FavoritesPayload } from "../lib/api";

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
      const token = getAuthToken();

      if (!token) {
        setIsLoading(false);
        setMessage("Please log in to view your saved listings.");
        return;
      }

      try {
        const favoritesResponse = await fetch(`${apiBaseUrl}/api/v1/favorites`, {
          headers: authHeader()
        });
        const favoritesBody = (await favoritesResponse.json()) as ApiResponse<FavoritesPayload>;

        if (!isActive) {
          return;
        }

        if (!favoritesResponse.ok || !favoritesBody.ok) {
          setMessage(favoritesBody.ok ? "Favorites unavailable." : favoritesBody.error.message);
          return;
        }

        setFavorites(favoritesBody.data.favorites);
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

function FavoriteCard({ favorite }: { favorite: FavoriteListing }) {
  return (
    <article className="listing-card">
      <div className="listing-card-body">
        <div>
          <p className="listing-meta">{favorite.category.name}</p>
          <h2>{favorite.title}</h2>
        </div>
        <p className="muted">Saved {new Date(favorite.favoritedAt).toLocaleDateString("en-US")}</p>
        <div className="listing-card-footer">
          <strong>{formatPrice(favorite.price)}</strong>
          <Link href={`/listings/${favorite.id}`}>View details</Link>
        </div>
      </div>
    </article>
  );
}

function formatPrice(price: FavoriteListing["price"]): string {
  if (!price) {
    return "Price on request";
  }

  return `${price.amount} ${price.currency}`;
}
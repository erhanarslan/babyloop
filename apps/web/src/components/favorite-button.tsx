"use client";

import { useState } from "react";
import type { ApiResponse } from "@babyloop/shared";

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
  profileId: string;
  initiallyFavorited: boolean;
};

export function FavoriteButton({
  apiBaseUrl,
  listingId,
  profileId,
  initiallyFavorited
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initiallyFavorited);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/favorites`, {
        method: isFavorited ? "DELETE" : "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          profile_id: profileId,
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

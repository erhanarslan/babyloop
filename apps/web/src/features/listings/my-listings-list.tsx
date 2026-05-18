"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, EmptyState, LoadingBlock } from "../../components/ui";
import { getAuthToken } from "../../lib/auth-client";
import type { ListingSummary } from "../../lib/api";
import { fetchMyListings } from "./api";

type MyListingsListProps = {
  apiBaseUrl: string;
};

export function MyListingsList({ apiBaseUrl }: MyListingsListProps) {
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadListings() {
      if (!getAuthToken()) {
        setIsLoading(false);
        setMessage("Please log in to view your listings.");
        return;
      }

      try {
        const body = await fetchMyListings(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          setMessage(body.error.message);
          return;
        }

        setListings(body.data.listings);
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

    void loadListings();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl]);

  if (isLoading) {
    return <LoadingBlock title="Loading your listings" />;
  }

  if (message) {
    return (
      <EmptyState title="Listings unavailable" message={message} actionHref="/login" actionLabel="Login" />
    );
  }

  if (listings.length === 0) {
    return (
      <EmptyState
        title="No listings yet."
        message="Create your first BabyLoop listing from the sell page."
        actionHref="/sell"
        actionLabel="Sell an item"
      />
    );
  }

  return (
    <div className="listing-grid">
      {listings.map((listing) => (
        <article className="listing-card" key={listing.id}>
          <div className="listing-image" aria-label={`${listing.title} image preview`}>
            {listing.firstImage ? <span>Image metadata</span> : <span>No image</span>}
          </div>
          <div className="listing-card-body">
            <div>
              <p className="listing-meta">{listing.category.name}</p>
              <h2>{listing.title}</h2>
              <Badge tone={listing.status === "active" ? "success" : "neutral"}>
                {listing.status}
              </Badge>
            </div>
            <div className="listing-card-footer">
              <strong>{formatPrice(listing.price)}</strong>
              <Link href={`/listings/${listing.id}`}>View details</Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function formatPrice(price: ListingSummary["price"]): string {
  if (!price) {
    return "Price on request";
  }

  return `${price.amount} ${price.currency}`;
}

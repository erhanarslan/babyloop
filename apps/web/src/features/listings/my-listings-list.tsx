"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyState, LoadingBlock } from "../../components/ui";
import type { ListingSummary } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchMyListings } from "./api";
import {
  formatCategoryName,
  formatListingPrice,
  formatListingStatus
} from "./listing-display";

type MyListingsListProps = {
  apiBaseUrl: string;
};

export function MyListingsList({ apiBaseUrl }: MyListingsListProps) {
  const { dictionary } = useI18n();
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const clearProtectedState = useCallback(() => {
    setListings([]);
    setMessage(null);
    setIsLoading(false);
  }, []);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  useEffect(() => {
    let isActive = true;

    async function loadListings() {
      if (!(await requireAuth())) {
        return;
      }

      try {
        const body = await fetchMyListings(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          setMessage(getApiErrorMessage(body.error, dictionary));
          return;
        }

        setListings(body.data.listings);
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

    void loadListings();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary.common.apiUnavailable, requireAuth]);

  if (isCheckingAuth || isLoading) {
    return <LoadingBlock title={dictionary.listings.loadingMyListings} />;
  }

  if (message) {
    return (
      <EmptyState
        title={dictionary.listings.myListingsUnavailable}
        message={message}
        actionHref="/login"
        actionLabel={dictionary.common.login}
      />
    );
  }

  if (listings.length === 0) {
    return (
      <EmptyState
        title={dictionary.listings.noListingsTitle}
        message={dictionary.listings.noListingsBody}
        actionHref="/sell"
        actionLabel={dictionary.listings.sellItem}
      />
    );
  }

  return (
    <div className="listing-grid">
      {listings.map((listing) => (
        <article className="listing-card" key={listing.id}>
          <div className="listing-image" aria-label={`${listing.title} image preview`}>
            {listing.firstImage ? (
              <span>{dictionary.listings.imageMetadata}</span>
            ) : (
              <span>{dictionary.listings.noImage}</span>
            )}
          </div>
          <div className="listing-card-body">
            <div>
              <p className="listing-meta">{formatCategoryName(listing.category, dictionary)}</p>
              <h2>{listing.title}</h2>
              <Badge tone={listing.status === "active" ? "success" : "neutral"}>
                {formatListingStatus(listing.status, dictionary)}
              </Badge>
            </div>
            <div className="listing-card-footer">
              <strong>{formatListingPrice(listing.price, dictionary)}</strong>
              <Link href={`/listings/${listing.id}`}>{dictionary.common.viewDetails}</Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

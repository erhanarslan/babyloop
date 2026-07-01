"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../components/ui";
import type { RecentlyViewedListing } from "./recently-viewed-storage";
import { getRecentlyViewedListings } from "./recently-viewed-storage";
import { ListingImageFrame } from "./listing-image-frame";
import { formatListingPrice } from "./listing-display";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { recordProductEvent } from "../../features/product-events/api";

type RecentlyViewedListingsProps = {
  apiBaseUrl: string;
  currentListingId?: string;
};

export function RecentlyViewedListings({
  apiBaseUrl,
  currentListingId
}: RecentlyViewedListingsProps) {
  const { dictionary } = useI18n();
  const [recentListings, setRecentListings] = useState<RecentlyViewedListing[]>([]);

  useEffect(() => {
    function refreshRecentListings() {
      setRecentListings(
        getRecentlyViewedListings()
          .filter((listing) => listing.id !== currentListingId)
          .slice(0, 6)
      );
    }

    refreshRecentListings();
    window.addEventListener("babyloop:recently-viewed-listings-updated", refreshRecentListings);
    window.addEventListener("storage", refreshRecentListings);

    return () => {
      window.removeEventListener("babyloop:recently-viewed-listings-updated", refreshRecentListings);
      window.removeEventListener("storage", refreshRecentListings);
    };
  }, [currentListingId]);

  if (recentListings.length === 0) {
    return null;
  }

  return (
    <Card className="recently-viewed-panel babyloop-recently-viewed-panel">
      <div className="babyloop-recently-viewed-heading">
        <h2>Son baktıkların</h2>
        <Link className="babyloop-recently-viewed-all" href="/browse">
          Keşfe dön
        </Link>
      </div>

      <div className="recently-viewed-grid babyloop-recently-viewed-rail" aria-label="Son baktığın ilanlar">
        {recentListings.map((listing) => (
          <article className="recently-viewed-card babyloop-recently-viewed-card" key={listing.id}>
            <Link
              className="babyloop-recently-viewed-card-link"
              href={`/listings/${listing.id}`}
              onClick={() => {
                void recordProductEvent(apiBaseUrl, {
                  categoryId: listing.category.id,
                  eventType: "recently_viewed_listing_clicked",
                  listingId: listing.id,
                  source: "recently_viewed"
                });
              }}
            >
              <ListingImageFrame
                alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
                apiBaseUrl={apiBaseUrl}
                className="recently-viewed-image"
                fallbackLabel={dictionary.listings.noProductImage}
                url={listing.firstImage?.url ?? null}
              />
              <div className="recently-viewed-body babyloop-recently-viewed-body">
                <h3>{listing.title}</h3>
                <strong>{formatListingPrice(listing.price, dictionary)}</strong>
                <span>{dictionary.common.viewDetails}</span>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </Card>
  );
}

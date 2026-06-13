"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card } from "../../components/ui";
import type { RecentlyViewedListing } from "./recently-viewed-storage";
import { getRecentlyViewedListings } from "./recently-viewed-storage";
import { ListingImageFrame } from "./listing-image-frame";
import {
  formatCategoryName,
  formatListingCondition,
  formatListingPrice,
  formatListingType
} from "./listing-display";
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
    <Card className="recently-viewed-panel">
      <div className="section-heading">
        <h2>Recently viewed</h2>
        <p className="muted">Listings you opened on this device.</p>
      </div>

      <div className="recently-viewed-grid">
        {recentListings.map((listing) => (
          <article className="recently-viewed-card" key={listing.id}>
            <ListingImageFrame
              alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
              apiBaseUrl={apiBaseUrl}
              className="recently-viewed-image"
              fallbackLabel={dictionary.listings.noProductImage}
              url={listing.firstImage?.url ?? null}
            />
            <div className="recently-viewed-body">
              <div className="listing-card-badges">
                <Badge>{formatCategoryName(listing.category, dictionary)}</Badge>
                <Badge tone="success">{formatListingType(listing.listingType, dictionary)}</Badge>
              </div>
              <h3>{listing.title}</h3>
              <p className="muted">
                {dictionary.listings.conditionLabel}: {formatListingCondition(listing.condition, dictionary)}
              </p>
              <div className="listing-card-footer">
                <strong>{formatListingPrice(listing.price, dictionary)}</strong>
                <Link
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
                  {dictionary.common.viewDetails}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

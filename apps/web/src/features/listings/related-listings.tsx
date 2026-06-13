"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge, Card } from "../../components/ui";
import type {
  ListingRecommendationsPayload,
  ListingSummary
} from "../../lib/api";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { recordProductEvent } from "../../features/product-events/api";
import { ListingImageFrame } from "./listing-image-frame";
import {
  formatCategoryName,
  formatListingCondition,
  formatListingPrice,
  formatListingType
} from "./listing-display";

type RelatedListingsProps = {
  apiBaseUrl: string;
  listingId: string;
};

export function RelatedListings({ apiBaseUrl, listingId }: RelatedListingsProps) {
  const { dictionary } = useI18n();
  const [relatedListings, setRelatedListings] = useState<ListingSummary[]>([]);
  const impressionKeyRef = useRef("");

  useEffect(() => {
    let isActive = true;

    async function loadRecommendations() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/listings/${listingId}/recommendations?limit=6`,
          {
            cache: "no-store"
          }
        );
        const body = (await response.json()) as ApiResponse<ListingRecommendationsPayload>;

        if (!isActive || !body.ok) {
          return;
        }

        setRelatedListings(body.data.recommendations);
      } catch {
        if (isActive) {
          setRelatedListings([]);
        }
      }
    }

    void loadRecommendations();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, listingId]);

  useEffect(() => {
    const impressionKey = relatedListings.map((listing) => listing.id).join(",");

    if (!impressionKey || impressionKey === impressionKeyRef.current) {
      return;
    }

    impressionKeyRef.current = impressionKey;

    for (const listing of relatedListings) {
      void recordProductEvent(apiBaseUrl, {
        categoryId: listing.category.id,
        eventType: "listing_recommendation_impression",
        listingId: listing.id,
        source: "recommendation"
      });
    }
  }, [apiBaseUrl, relatedListings]);

  if (relatedListings.length === 0) {
    return null;
  }

  return (
    <Card className="related-listings-panel">
      <div className="section-heading">
        <h2>Related listings</h2>
        <p className="muted">Similar active listings from BabyLoop.</p>
      </div>

      <div className="related-listings-grid">
        {relatedListings.map((listing) => (
          <article className="related-listing-card" key={listing.id}>
            <ListingImageFrame
              alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
              apiBaseUrl={apiBaseUrl}
              className="related-listing-image"
              fallbackLabel={dictionary.listings.noProductImage}
              url={listing.firstImage?.url ?? null}
            />
            <div className="related-listing-body">
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
                      eventType: "listing_card_clicked",
                      listingId: listing.id,
                      source: "recommendation"
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

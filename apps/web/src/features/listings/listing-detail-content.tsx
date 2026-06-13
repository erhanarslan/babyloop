"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Badge,
  Card,
  EmptyState,
  PageContainer,
  PageHeading
} from "../../components/ui";
import { FavoriteButton } from "../../features/favorites/favorite-button";
import { MessageSellerButton } from "../../features/messaging/message-seller-button";
import { reportListing } from "../../features/safety/api";
import { ReportAction } from "../../features/safety/report-action";
import { recordProductEvent } from "../../features/product-events/api";
import type { ListingDetailPayload } from "../../lib/api";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { ListingImageFrame } from "./listing-image-frame";
import { RecentlyViewedListings } from "./recently-viewed-listings";
import { RecentlyViewedTracker } from "./recently-viewed-tracker";
import { RelatedListings } from "./related-listings";
import {
  formatCategoryName,
  formatDateTime,
  formatListingCondition,
  formatListingPrice,
  formatListingStatus,
  formatListingType
} from "./listing-display";

type ListingDetailContentProps = {
  apiBaseUrl: string;
  listing: ListingDetailPayload["listing"];
};

export function ListingDetailContent({
  apiBaseUrl,
  listing
}: ListingDetailContentProps) {
  const { dictionary, locale } = useI18n();

  useEffect(() => {
    void recordProductEvent(apiBaseUrl, {
      categoryId: listing.category.id,
      eventType: "listing_detail_viewed",
      listingId: listing.id,
      source: "listing_detail"
    });
  }, [apiBaseUrl, listing.category.id, listing.id]);

  return (
    <PageContainer className="detail-layout">
      <RecentlyViewedTracker listing={listing} />
      <div className="detail-media">
        {listing.images.length > 0 ? (
          <div className="detail-gallery" aria-label={dictionary.listings.imageGalleryAriaLabel}>
            {listing.images.map((image, index) => (
              <ListingImageFrame
                alt={dictionary.listings.detailImageAlt
                  .replace("{title}", listing.title)
                  .replace("{index}", String(index + 1))}
                apiBaseUrl={apiBaseUrl}
                className={index === 0 ? "detail-image detail-image-primary" : "detail-image"}
                fallbackLabel={dictionary.listings.imageUnavailable}
                key={image.id}
                url={image.url}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={dictionary.listings.noPhotosTitle}
            message={dictionary.listings.noPhotosBody}
          />
        )}
      </div>

      <article className="detail-panel">
        <Link className="back-link" href="/browse">
          {dictionary.listings.browseListings}
        </Link>
        <div className="listing-card-badges">
          <Badge>{formatCategoryName(listing.category, dictionary)}</Badge>
          <Badge tone="success">
            {dictionary.listings.typeLabel}: {formatListingType(listing.listingType, dictionary)}
          </Badge>
          <Badge>
            {dictionary.listings.conditionLabel}: {formatListingCondition(listing.condition, dictionary)}
          </Badge>
          <Badge tone={listing.status === "reserved" ? "warning" : "success"}>
            {dictionary.listings.statusLabel}: {formatListingStatus(listing.status, dictionary)}
          </Badge>
        </div>
        <h1>{listing.title}</h1>
        <strong className="detail-price">{formatListingPrice(listing.price, dictionary)}</strong>
        <p className="listing-meta">
          {dictionary.listings.favoriteCount.replace("{count}", String(listing.favoriteCount))}
        </p>
        <p className="detail-description">
          {listing.description ?? dictionary.listings.noDescription}
        </p>

        <div className="detail-actions" aria-label={dictionary.listings.listingActionsAriaLabel}>
          <FavoriteButton
            apiBaseUrl={apiBaseUrl}
            initiallyFavorited={false}
            listingId={listing.id}
          />
          <MessageSellerButton
            apiBaseUrl={apiBaseUrl}
            listingId={listing.id}
            sellerProfileId={listing.seller.id}
          />
          <ReportAction
            actionLabel={dictionary.safety.reportListing}
            onSubmitReport={(payload) => reportListing(apiBaseUrl, listing.id, payload)}
          />
        </div>

        <SellerCard listing={listing} />
        <RecentlyViewedListings apiBaseUrl={apiBaseUrl} currentListingId={listing.id} />
        <RelatedListings apiBaseUrl={apiBaseUrl} listingId={listing.id} />

        <dl className="detail-facts">
          <div>
            <dt>{dictionary.listings.location}</dt>
            <dd>{listing.seller.locationCity ?? dictionary.common.notProvided}</dd>
          </div>
          <div>
            <dt>{dictionary.listings.condition}</dt>
            <dd>{formatListingCondition(listing.condition, dictionary)}</dd>
          </div>
          <div>
            <dt>{dictionary.listings.listingType}</dt>
            <dd>{formatListingType(listing.listingType, dictionary)}</dd>
          </div>
          <div>
            <dt>{dictionary.listings.created}</dt>
            <dd>{formatDateTime(listing.createdAt, locale)}</dd>
          </div>
          <div>
            <dt>{dictionary.listings.updated}</dt>
            <dd>{formatDateTime(listing.updatedAt, locale)}</dd>
          </div>
        </dl>
      </article>
    </PageContainer>
  );
}

export function ListingDetailUnavailable({ error }: { error: ApiError }) {
  const { dictionary } = useI18n();

  return (
    <>
      <PageHeading
        eyebrow={dictionary.listings.detailEyebrow}
        title={dictionary.listings.detailUnavailableTitle}
        description={getApiErrorMessage(error, dictionary)}
      />
      <PageContainer>
        <Link className="primary-link" href="/browse">
          {dictionary.common.backToBrowse}
        </Link>
      </PageContainer>
    </>
  );
}

function SellerCard({ listing }: { listing: ListingDetailPayload["listing"] }) {
  const { dictionary } = useI18n();
  const avatarUrl = getSafeImageUrl(listing.seller.avatarUrl);

  return (
    <Card className="seller-card" aria-label={dictionary.listings.sellerInformationAriaLabel}>
      <div className="seller-avatar" aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <span>{listing.seller.displayName.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div>
        <p className="listing-meta">{dictionary.listings.seller}</p>
        <h2>{listing.seller.displayName}</h2>
        <p className="muted">{listing.seller.locationCity ?? dictionary.listings.locationNotProvided}</p>
      </div>
    </Card>
  );
}

function getSafeImageUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

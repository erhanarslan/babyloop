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
import { getPrimaryGuideForCategorySlug } from "../parent-guides/parent-guide-data";
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

        <ListingImageOverview listing={listing} />
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

        <ListingAvailabilityNotice listing={listing} />

        <div className="detail-action-panel">
          <div className="detail-action-panel-header">
            <p className="listing-meta">{dictionary.publicPages.listingDetail.details}</p>
            <h2>{dictionary.publicPages.listingDetail.messageSeller}</h2>
            <p>{dictionary.publicPages.listingDetail.safetyBody}</p>
          </div>

          <div className="detail-actions" aria-label={dictionary.listings.listingActionsAriaLabel}>
            <FavoriteButton
              apiBaseUrl={apiBaseUrl}
              initiallyFavorited={false}
              listingId={listing.id}
            />
            <MessageSellerButton
              apiBaseUrl={apiBaseUrl}
              categoryId={listing.category.id}
              listingId={listing.id}
              sellerProfileId={listing.seller.id}
            />
            <Link href={`/assistant?mode=safe_buying&prompt=${encodeURIComponent(`What should I check before buying ${listing.title}?`)}`}>
              {dictionary.publicPages.listingDetail.askAssistant}
            </Link>
          </div>

          <details className="listing-secondary-actions">
            <summary>{dictionary.publicPages.listingDetail.safety}</summary>
            <ReportAction
              actionLabel={dictionary.safety.reportListing}
              onSubmitReport={(payload) => reportListing(apiBaseUrl, listing.id, payload)}
            />
          </details>
        </div>

        <SellerCard listing={listing} />
        <details className="listing-secondary-actions">
          <summary>{dictionary.publicPages.support.guidesTitle}</summary>
          <ListingRelatedGuideCard categorySlug={listing.category.slug} />
        </details>
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

function ListingImageOverview({ listing }: { listing: ListingDetailPayload["listing"] }) {
  const imageCount = listing.images.length;

  return (
    <Card className="detail-image-overview" aria-label="Listing photo review summary">
      <p className="eyebrow">Photo review</p>
      <div className="detail-image-overview-list">
        <div>
          <span>Photos</span>
          <strong>{imageCount}</strong>
        </div>
        <div>
          <span>Primary check</span>
          <strong>{imageCount > 0 ? "Inspect visible wear" : "Ask for photos"}</strong>
        </div>
        <div>
          <span>Buyer note</span>
          <strong>Request unclear angles</strong>
        </div>
      </div>
    </Card>
  );
}

function ListingAvailabilityNotice({ listing }: { listing: ListingDetailPayload["listing"] }) {
  const { dictionary } = useI18n();
  const status = formatListingStatus(listing.status, dictionary);
  const isAvailable = listing.status === "active" || listing.status === "reserved";

  return (
    <div className={`listing-availability-notice${isAvailable ? "" : " warning"}`}>
      <strong>{isAvailable ? "Conversation can start from this listing" : `Listing status: ${status}`}</strong>
      <p>
        {isAvailable
          ? "Use BabyLoop messaging to confirm condition, included parts, pickup expectations, and final availability before meeting."
          : "This listing may not be publicly actionable. Browse related listings or ask the assistant for adjacent options."}
      </p>
    </div>
  );
}

function ListingRelatedGuideCard({ categorySlug }: { categorySlug: string }) {
  const topic = getPrimaryGuideForCategorySlug(categorySlug);

  if (!topic) {
    return null;
  }

  return (
    <Card className="seller-card parent-guide-listing-card" aria-label="Related parent guide">
      <div>
        <p className="listing-meta">Parent guide</p>
        <h2>{topic.title}</h2>
        <p className="muted">{topic.summary}</p>
        <p className="form-note">
          <strong>Common misconception:</strong> {topic.knownMyth}
        </p>
        <div className="home-personalization-actions">
          <Link href="/guides">Read guide</Link>
          <Link href={topic.browseHref}>Find related listings</Link>
          <Link
            href={buildAssistantHref(
              "find_products",
              `Turn the ${topic.title} guide into a short BabyLoop browsing checklist.`
            )}
          >
            Ask Assistant
          </Link>
        </div>
      </div>
    </Card>
  );
}

function SellerCard({ listing }: { listing: ListingDetailPayload["listing"] }) {
  const { dictionary } = useI18n();
  const avatarUrl = getSafeImageUrl(listing.seller.avatarUrl);

  return (
    <Card className="seller-card seller-card-enhanced" aria-label={dictionary.listings.sellerInformationAriaLabel}>
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
        <ul className="seller-trust-list">
          <li>Seller contact details stay hidden on the public listing.</li>
          <li>Questions should start through BabyLoop participant-only messaging.</li>
          <li>Use report actions if the listing looks misleading, unsafe, or suspicious.</li>
        </ul>
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

type AssistantEntryMode = "age_needs" | "find_products" | "sell_help" | "safe_buying" | "platform_help";

function buildAssistantHref(mode: AssistantEntryMode, prompt: string): string {
  const params = new URLSearchParams({
    mode,
    prompt
  });

  return `/assistant?${params.toString()}`;
}

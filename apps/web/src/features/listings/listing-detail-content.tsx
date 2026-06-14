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

        <BuyerGuidanceCard listing={listing} />

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
          <ReportAction
            actionLabel={dictionary.safety.reportListing}
            onSubmitReport={(payload) => reportListing(apiBaseUrl, listing.id, payload)}
          />
        </div>

        <SellerCard listing={listing} />
        <ListingRelatedGuideCard categorySlug={listing.category.slug} />
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

function BuyerGuidanceCard({ listing }: { listing: ListingDetailPayload["listing"] }) {
  const { dictionary } = useI18n();
  const questions = getBuyerQuestions(listing);
  const safetyChecks = getSafetyChecks(listing);

  return (
    <Card className="buyer-guidance-card" aria-label="Buyer guidance">
      <div className="buyer-guidance-header">
        <div>
          <p className="listing-meta">Buyer guide</p>
          <h2>Ask better questions before messaging</h2>
          <p className="muted">
            Use these checks to understand condition, included parts, pickup expectations, and safety-sensitive details before deciding.
          </p>
        </div>
        <div className="home-personalization-actions">
          <Link href="/guides">Open parent guides</Link>
          <Link
            href={buildAssistantHref(
              "safe_buying",
              `What should I check before buying a second-hand ${formatCategoryName(
                listing.category,
                dictionary
              )} item like ${listing.title}?`
            )}
          >
            Ask Assistant
          </Link>
        </div>
      </div>

      <div className="buyer-guidance-grid">
        <div>
          <h3>Suggested seller questions</h3>
          <ul className="question-list">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Quick safety checklist</h3>
          <ul className="question-list">
            {safetyChecks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="state-panel warning">
        Keep payment, pickup, and contact details inside BabyLoop messages until you feel comfortable. Report listings that look misleading or unsafe.
      </div>

      <dl className="compact-details buyer-guidance-facts">
        <div>
          <dt>Type</dt>
          <dd>{formatListingType(listing.listingType, dictionary)}</dd>
        </div>
        <div>
          <dt>Condition</dt>
          <dd>{formatListingCondition(listing.condition, dictionary)}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{formatCategoryName(listing.category, dictionary)}</dd>
        </div>
      </dl>
    </Card>
  );
}

function getBuyerQuestions(listing: ListingDetailPayload["listing"]): string[] {
  const questions = [
    "Are there any stains, missing parts, repairs, or defects that are not visible in the photos?",
    "Which accessories, manuals, spare parts, or boxes are included?",
    "How long was it used, and why are you selling it?",
    "Can you share one more clear photo of the most worn area?"
  ];

  if (listing.price) {
    questions.push("Is the listed price final, or is there room for a reasonable offer?");
  }

  if (listing.listingType === "swap") {
    questions.push("What kind of item would you consider for a swap?");
  }

  if (listing.listingType === "donation") {
    questions.push("Is pickup timing flexible for donation handover?");
  }

  if (isSafetySensitiveCategory(listing.category.slug)) {
    questions.push("Has the product ever been involved in an accident, recall, or safety issue?");
  }

  return questions;
}

function getSafetyChecks(listing: ListingDetailPayload["listing"]): string[] {
  const checks = [
    "Confirm the product matches the child's current stage and size.",
    "Check photos for fabric wear, broken parts, missing straps, loose screws, and hygiene.",
    "Prefer clear pickup expectations before arranging handover."
  ];

  if (listing.condition === "fair" || listing.condition === "needs_repair") {
    checks.push("This condition needs extra review before use; ask what repair or cleaning is required.");
  }

  if (isSafetySensitiveCategory(listing.category.slug)) {
    checks.push("For safety-sensitive gear, verify history, stability, labels, and all locking mechanisms before use.");
  }

  return checks;
}

function isSafetySensitiveCategory(categorySlug: string): boolean {
  return [
    "car-seats",
    "strollers",
    "feeding",
    "sleep",
    "travel"
  ].includes(categorySlug);
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

type AssistantEntryMode = "age_needs" | "find_products" | "sell_help" | "safe_buying" | "platform_help";

function buildAssistantHref(mode: AssistantEntryMode, prompt: string): string {
  const params = new URLSearchParams({
    mode,
    prompt
  });

  return `/assistant?${params.toString()}`;
}

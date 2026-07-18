"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminListingAuditEvent,
  type AdminListingDetail as AdminListingDetailType,
  getAdminListing,
} from "./api";
import { ListingImageReviewPanel } from "./listing-image-review-panel";
import { ListingPublicationReviewPanel } from "./listing-publication-review-panel";
import { ListingStatusActionForm } from "./listing-status-action-form";
import { RelatedModerationCases } from "./related-moderation-cases";

type ListingAdminDetailProps = {
  listingId: string;
};

export function ListingAdminDetail({ listingId }: ListingAdminDetailProps) {
  const [listing, setListing] = useState<AdminListingDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadListing() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminListing(listingId);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setListing(null);
        setErrorMessage(getApiErrorMessage(response, "Could not load listing."));
        setIsLoading(false);
        return;
      }

      setListing(response.data.listing);
      setIsLoading(false);
    }

    void loadListing();

    return () => {
      isActive = false;
    };
  }, [listingId]);

  if (isLoading) {
    return <div className="state-panel">Loading listing...</div>;
  }

  if (errorMessage) {
    return (
      <div className="state-panel danger" role="alert">
        {errorMessage}
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="state-panel">
        <strong>Listing not found</strong>
      </div>
    );
  }

  const needsReviewImages = listing.images.filter((image) => image.reviewStatus === "needs_review");

  return (
    <div className="detail-layout">
      <section className="content-card">
        <Link className="secondary-action" href="/listings">
          Back to listings
        </Link>

        {needsReviewImages.length > 0 ? (
          <div
            className="state-panel"
            data-admin-images-awaiting-review-panel={listing.id}
          >
            <strong>Images awaiting review</strong>
            <p>
              {needsReviewImages.length} image{needsReviewImages.length === 1 ? "" : "s"} are hidden
              from public listing responses until approved.
            </p>
          </div>
        ) : null}

        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Listing review</p>
            <h2>{listing.title}</h2>
            <p>{listing.description ?? "No description provided."}</p>
          </div>

          <div className="case-card-header">
            <span className={`status-badge ${listing.status}`}>
              {getStatusLabel(listing.status)}
            </span>
            <span className={`status-badge publication-${listing.publicationState}`}>
              {getPublicationStateLabel(listing.publicationState)}
            </span>
          </div>
        </div>

        <dl className="details-grid">
          <div>
            <dt>Listing ID</dt>
            <dd>{listing.id}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{getStatusLabel(listing.status)}</dd>
          </div>
          <div>
            <dt>Yayın süreci</dt>
            <dd>{getPublicationStateLabel(listing.publicationState)}</dd>
          </div>
          <div>
            <dt>Planlanan yayın</dt>
            <dd>{listing.publishAfter ? formatDateTime(listing.publishAfter) : "—"}</dd>
          </div>
          <div>
            <dt>Yayınlanma</dt>
            <dd>{listing.publishedAt ? formatDateTime(listing.publishedAt) : "—"}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{formatPrice(listing)}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{listing.listingType}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{listing.condition}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{listing.category.name}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDateTime(listing.createdAt)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatDateTime(listing.updatedAt)}</dd>
          </div>
          <div>
            <dt>Images awaiting review</dt>
            <dd>{needsReviewImages.length}</dd>
          </div>
        </dl>

        {listing.publicationReviewReason ? (
          <section className="note-panel warning">
            <h3>Son düzeltme gerekçesi</h3>
            <p>{listing.publicationReviewReason}</p>
          </section>
        ) : null}

        <section className="note-panel">
          <h3>Seller summary</h3>
          <p>
            Privacy-safe profile summary only. Seller email, phone, and raw user
            records are not included in this review view.
          </p>
          <dl className="details-grid">
            <div>
              <dt>Profile ID</dt>
              <dd>{listing.seller.profileId}</dd>
            </div>
            <div>
              <dt>Display name</dt>
              <dd>{listing.seller.displayName}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{listing.seller.locationCity ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Profile created</dt>
              <dd>{formatDateTime(listing.seller.createdAt)}</dd>
            </div>
          </dl>
        </section>
      </section>

      <section className="side-stack">
        <ListingPublicationReviewPanel listing={listing} onApplied={setListing} />
        <ListingStatusActionForm listing={listing} onApplied={setListing} />
        <ListingImageReviewPanel
          images={listing.images}
          listingId={listing.id}
          onReviewed={setListing}
        />
        <RelatedModerationCases cases={listing.relatedModerationCases} />
      </section>

      <section className="content-card full-span">
        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Audit</p>
            <h2>Listing action audit</h2>
            <p>
              Safe listing-scoped admin activity, image review actions, and
              related moderation enforcement events. Sensitive access remains separate.
            </p>
          </div>
        </div>

        {listing.auditTrail.length === 0 ? (
          <div className="state-panel">No listing action audit events yet.</div>
        ) : (
          <div className="timeline">
            {listing.auditTrail.map((event) => (
              <article className="timeline-item audit_event" key={event.id}>
                <div>
                  <strong>{getAuditEventLabel(event)}</strong>
                  <p>{event.eventType}</p>
                </div>

                <dl className="compact-details">
                  <div>
                    <dt>Actor</dt>
                    <dd>{event.actor?.displayName ?? event.actor?.id ?? "System"}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateTime(event.createdAt)}</dd>
                  </div>
                </dl>

                <div className="metadata-chip-row">
                  {Object.entries(sanitizeAdminListingAuditMetadata(event.metadata)).map(([key, value]) => (
                    <span className="metadata-chip" key={`${event.id}:${key}`}>
                      <strong>{formatMetadataKey(key)}</strong>
                      {formatMetadataValue(value)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "active":
      return "Active";
    case "reserved":
      return "Reserved";
    case "sold":
      return "Sold";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}


function getPublicationStateLabel(
  state: AdminListingDetailType["publicationState"],
): string {
  switch (state) {
    case "awaiting_images":
      return "Görsel bekliyor";
    case "ai_review":
      return "AI / görsel incelemesi";
    case "admin_review":
      return "Admin onayı bekliyor";
    case "scheduled":
      return "Otomatik yayın sırası";
    case "published":
      return "Yayında";
    case "changes_requested":
      return "Düzeltme istendi";
  }
}

function formatPrice(listing: AdminListingDetailType): string {
  return listing.price
    ? `${listing.price.amount} ${listing.price.currency}`
    : "Not set";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR");
}

function getAuditEventLabel(event: AdminListingAuditEvent): string {
  if (event.eventType === "admin_listing_action_applied") {
    const action = event.metadata.action;

    if (action === "archive") {
      return "Listing archived";
    }

    if (action === "restore") {
      return "Listing restored";
    }
  }

  if (event.eventType === "listing_publication_approved") {
    return "İlan yayınlandı";
  }

  if (event.eventType === "listing_publication_changes_requested") {
    return "İlanda düzeltme istendi";
  }

  if (event.eventType === "listing_auto_published") {
    return "İlan otomatik yayınlandı";
  }

  if (event.eventType === "listing_publication_state_changed") {
    return "Yayın süreci güncellendi";
  }

  if (event.eventType === "admin_listing_image_review_applied") {
    const action = event.metadata.action;

    if (action === "approve") {
      return "Image approved";
    }

    if (action === "reject") {
      return "Image rejected";
    }
  }

  if (event.eventType === "admin_moderation_enforcement") {
    return "Moderation enforcement applied";
  }

  return "Listing audit event";
}

const SAFE_ADMIN_LISTING_AUDIT_METADATA_KEYS = [
  "action",
  "enforcementAction",
  "authenticityDecision",
  "authenticityProvider",
  "imageId",
  "listingId",
  "moderationActionId",
  "nextStatus",
  "nextReviewStatus",
  "nextPublicationState",
  "previousStatus",
  "previousPublicationState",
  "previousReviewStatus",
  "publishAfter",
  "reasonLength",
  "result",
  "resultingStatus",
  "targetId",
  "targetType"
];

function sanitizeAdminListingAuditMetadata(
  metadata: Record<string, string | number | boolean | string[] | null>,
): Record<string, string | number | boolean | string[] | null> {
  const safeMetadata: Record<string, string | number | boolean | string[] | null> = {};

  for (const key of SAFE_ADMIN_LISTING_AUDIT_METADATA_KEYS) {
    const value = metadata[key];

    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      (Array.isArray(value) && value.every((item) => typeof item === "string"))
    ) {
      safeMetadata[key] = value;
    }
  }

  return safeMetadata;
}

function formatMetadataKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatMetadataValue(
  value: string | number | boolean | string[] | null,
): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "none";
  }

  if (value === null) {
    return "none";
  }

  return String(value);
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.message ?? fallback;
}

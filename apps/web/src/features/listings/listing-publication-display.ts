import type { ListingSummary } from "../../lib/api";

export type ListingPublicationDisplay = {
  isPending: boolean;
  needsAttention: boolean;
  title: string | null;
  message: string | null;
  tooltip: string | null;
};

const PENDING_PUBLICATION_STATES = new Set([
  "awaiting_images",
  "ai_review",
  "admin_review",
  "scheduled",
]);

export function getListingPublicationDisplay(
  listing: Pick<ListingSummary, "publicationState" | "status" | "publicationReviewReason">,
): ListingPublicationDisplay {
  if (listing.publicationState === "changes_requested") {
    return {
      isPending: false,
      needsAttention: true,
      title: "İlanında düzenleme gerekiyor",
      message:
        listing.publicationReviewReason ??
        "İlanını düzenleyip yeniden onay sürecine gönderebilirsin.",
      tooltip: "Düzenleme gerekli",
    };
  }

  if (
    listing.status === "draft" &&
    (PENDING_PUBLICATION_STATES.has(listing.publicationState) ||
      listing.publicationState !== "published")
  ) {
    return {
      isPending: true,
      needsAttention: false,
      title: "İlanın onay sürecinde",
      message: null,
      tooltip: "Onay bekliyor",
    };
  }

  return {
    isPending: false,
    needsAttention: false,
    title: null,
    message: null,
    tooltip: null,
  };
}

export function hasPendingListingPublication(
  listings: Array<Pick<ListingSummary, "publicationState" | "status" | "publicationReviewReason">>,
): boolean {
  return listings.some((listing) => getListingPublicationDisplay(listing).isPending);
}

import type {
  MobileListingPublicationState,
  MobileListingStatus,
} from "./listings-api";

export type MobileListingStatusAction = {
  label: string;
  status: MobileListingStatus;
  tone: "primary" | "secondary" | "danger";
};

export type MobileMyListingStatusFilter = "all" | MobileListingStatus;

export type MobileListingPublicationDisplay = {
  isPending: boolean;
  needsAttention: boolean;
  title: string | null;
  message: string | null;
};

export function getMobileListingPublicationDisplay(input: {
  publicationState: MobileListingPublicationState;
  publicationReviewReason: string | null;
  status: string | null | undefined;
}): MobileListingPublicationDisplay {
  if (input.publicationState === "changes_requested") {
    return {
      isPending: false,
      needsAttention: true,
      title: "İlanında düzenleme gerekiyor",
      message:
        input.publicationReviewReason ??
        "İlanını düzenleyip yeniden onay sürecine gönderebilirsin.",
    };
  }

  if (
    input.status === "draft" &&
    (input.publicationState === "awaiting_images" ||
      input.publicationState === "ai_review" ||
      input.publicationState === "admin_review" ||
      input.publicationState === "scheduled" ||
      input.publicationState !== "published")
  ) {
    return {
      isPending: true,
      needsAttention: false,
      title: "İlanın onay sürecinde",
      message: null,
    };
  }

  return {
    isPending: false,
    needsAttention: false,
    title: null,
    message: null,
  };
}

export function hasPendingMobileListingPublication(
  listings: Array<{
    publicationState: MobileListingPublicationState;
    publicationReviewReason: string | null;
    status: string | null | undefined;
  }>,
): boolean {
  return listings.some((listing) => getMobileListingPublicationDisplay(listing).isPending);
}

export type MobileMyListingStats = {
  active: number;
  draft: number;
  archived: number;
  reserved: number;
  sold: number;
  total: number;
};

export const MOBILE_MY_LISTING_STATUS_FILTERS: MobileMyListingStatusFilter[] = [
  "all",
  "draft",
  "active",
  "reserved",
  "sold",
  "archived"
];

export function getMobileListingStatusActions(
  currentStatus: string | null | undefined
): MobileListingStatusAction[] {
  switch (currentStatus) {
    case "draft":
      return [
        {
          label: "Yeniden onaya gönder",
          status: "active",
          tone: "primary"
        }
      ];

    case "active":
      return [
        {
          label: "Rezerve et",
          status: "reserved",
          tone: "secondary"
        },
        {
          label: "Satıldı olarak işaretle",
          status: "sold",
          tone: "danger"
        },
        {
          label: "Yayından kaldır",
          status: "archived",
          tone: "secondary"
        }
      ];

    case "reserved":
      return [
        {
          label: "Yayına al",
          status: "active",
          tone: "secondary"
        },
        {
          label: "Satıldı olarak işaretle",
          status: "sold",
          tone: "danger"
        },
        {
          label: "Yayından kaldır",
          status: "archived",
          tone: "secondary"
        }
      ];

    case "sold":
      return [
        {
          label: "Arşive taşı",
          status: "archived",
          tone: "secondary"
        }
      ];

    case "archived":
      return [
        {
          label: "Yeniden onaya gönder",
          status: "active",
          tone: "primary"
        }
      ];

    default:
      return [];
  }
}

export function getMobileMyListingStatusFilterLabel(
  filter: MobileMyListingStatusFilter
): string {
  switch (filter) {
    case "all":
      return "Tümü";
    case "draft":
      return "Yayında değil";
    case "active":
      return "Yayında";
    case "reserved":
      return "Rezerve";
    case "sold":
      return "Satıldı";
    case "archived":
      return "Arşivde";
  }
}

export function filterMobileMyListings<T extends { status: string | null | undefined }>(
  listings: T[],
  filter: MobileMyListingStatusFilter
): T[] {
  if (filter === "all") {
    return listings;
  }

  return listings.filter((listing) => listing.status === filter);
}

export function getMobileMyListingStats(
  listings: Array<{ status: string | null | undefined }>
): MobileMyListingStats {
  return listings.reduce<MobileMyListingStats>(
    (stats, listing) => {
      stats.total += 1;

      if (listing.status === "draft") {
        stats.draft += 1;
      }

      if (listing.status === "active") {
        stats.active += 1;
      }

      if (listing.status === "reserved") {
        stats.reserved += 1;
      }

      if (listing.status === "sold") {
        stats.sold += 1;
      }

      if (listing.status === "archived") {
        stats.archived += 1;
      }

      return stats;
    },
    {
      active: 0,
      draft: 0,
      archived: 0,
      reserved: 0,
      sold: 0,
      total: 0
    }
  );
}

export function getMobileListingStatusActionMessage(
  nextStatus: MobileListingStatus,
  currentStatus?: string | null,
): string {
  switch (nextStatus) {
    case "draft":
      return "İlan taslak durumuna alındı.";
    case "active":
      return currentStatus === "draft" || currentStatus === "archived"
        ? "İlanın onay sürecine gönderildi."
        : "İlan yeniden yayına alındı.";
    case "reserved":
      return "İlan rezerve olarak işaretlendi.";
    case "sold":
      return "İlan satıldı olarak işaretlendi ve alıcı aksiyonlarına kapatıldı.";
    case "archived":
      return "İlan arşive taşındı.";
  }
}

export function canSubmitMobileListingStatusAction(input: {
  listingId: string;
  nextStatus: MobileListingStatus;
  pendingListingId: string | null;
}): boolean {
  return input.pendingListingId === null || input.pendingListingId === input.listingId;
}

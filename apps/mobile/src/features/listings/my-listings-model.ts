import type { MobileListingStatus } from "./listings-api";

export type MobileListingStatusAction = {
  label: string;
  status: MobileListingStatus;
  tone: "primary" | "secondary" | "danger";
};

export type MobileMyListingStatusFilter = "all" | MobileListingStatus;

export type MobileMyListingStats = {
  active: number;
  archived: number;
  reserved: number;
  sold: number;
  total: number;
};

export const MOBILE_MY_LISTING_STATUS_FILTERS: MobileMyListingStatusFilter[] = [
  "all",
  "active",
  "reserved",
  "sold",
  "archived"
];

export function getMobileListingStatusActions(
  currentStatus: string | null | undefined
): MobileListingStatusAction[] {
  switch (currentStatus) {
    case "active":
      return [
        {
          label: "Satıldı",
          status: "sold",
          tone: "primary"
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
          label: "Satıldı",
          status: "sold",
          tone: "primary"
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
          label: "Yayından kaldır",
          status: "archived",
          tone: "secondary"
        }
      ];

    case "archived":
      return [
        {
          label: "Yayına al",
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
    case "active":
      return "Aktif";
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
      archived: 0,
      reserved: 0,
      sold: 0,
      total: 0
    }
  );
}

export function getMobileListingStatusActionMessage(
  nextStatus: MobileListingStatus
): string {
  switch (nextStatus) {
    case "active":
      return "İlan yeniden yayına alındı.";
    case "reserved":
      return "İlan rezerve olarak işaretlendi.";
    case "sold":
      return "İlan satıldı olarak işaretlendi.";
    case "archived":
      return "İlan yayından kaldırıldı.";
  }
}

export function canSubmitMobileListingStatusAction(input: {
  listingId: string;
  nextStatus: MobileListingStatus;
  pendingListingId: string | null;
}): boolean {
  return input.pendingListingId === null || input.pendingListingId === input.listingId;
}

import type { ListingSummary } from "../../lib/api";

export type RecentlyViewedListing = ListingSummary & {
  viewedAt: string;
};

const RECENTLY_VIEWED_LISTINGS_KEY = "babyloop_recently_viewed_listings_v1";
const RECENTLY_VIEWED_MAX_ITEMS = 12;
const RECENTLY_VIEWED_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function getRecentlyViewedListings(now: Date = new Date()): RecentlyViewedListing[] {
  if (!canUseBrowserStorage()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(RECENTLY_VIEWED_LISTINGS_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter(isRecentlyViewedListing)
      .filter((listing) => isWithinTtl(listing, now))
      .slice(0, RECENTLY_VIEWED_MAX_ITEMS);
  } catch {
    return [];
  }
}

export function saveRecentlyViewedListing(listing: ListingSummary, now: Date = new Date()): void {
  if (!canUseBrowserStorage()) {
    return;
  }

  const safeListing: RecentlyViewedListing = {
    ...listing,
    viewedAt: now.toISOString()
  };
  const existingListings = getRecentlyViewedListings(now)
    .filter((recentListing) => recentListing.id !== listing.id);
  const nextListings = [safeListing, ...existingListings].slice(0, RECENTLY_VIEWED_MAX_ITEMS);

  try {
    window.localStorage.setItem(RECENTLY_VIEWED_LISTINGS_KEY, JSON.stringify(nextListings));
    window.dispatchEvent(new CustomEvent("babyloop:recently-viewed-listings-updated"));
  } catch {
    // Browsers can reject storage writes in private mode or quota-limited environments.
  }
}

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isWithinTtl(listing: RecentlyViewedListing, now: Date): boolean {
  const viewedAt = Date.parse(listing.viewedAt);

  if (!Number.isFinite(viewedAt)) {
    return false;
  }

  return now.getTime() - viewedAt <= RECENTLY_VIEWED_TTL_MS;
}

function isRecentlyViewedListing(value: unknown): value is RecentlyViewedListing {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RecentlyViewedListing>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.listingType === "string" &&
    typeof candidate.condition === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.viewedAt === "string" &&
    Boolean(candidate.category) &&
    typeof candidate.category?.id === "string" &&
    typeof candidate.category?.name === "string" &&
    typeof candidate.category?.slug === "string"
  );
}

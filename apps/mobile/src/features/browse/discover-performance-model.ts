import type { MobileListingSummary } from "../listings/listings-api";

const DISCOVER_HERO_LISTING_LIMIT = 10;

export function getDiscoverHeroListings(input: {
  activeFilterCount: number;
  listings: MobileListingSummary[];
  query: string;
}): MobileListingSummary[] | null {
  if (input.query.trim().length > 0 || input.activeFilterCount > 0) {
    return null;
  }

  return input.listings.slice(0, DISCOVER_HERO_LISTING_LIMIT);
}

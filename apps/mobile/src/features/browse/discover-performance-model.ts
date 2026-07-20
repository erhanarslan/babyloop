import type { MobileListingSummary } from "../listings/listings-api";

const DISCOVER_HERO_LISTING_LIMIT = 10;

export function getDiscoverHeroListings(input: {
  activeFilterCount: number;
  listings: MobileListingSummary[];
  query: string;
}): MobileListingSummary[] {
  if (input.query.trim().length > 0 || input.activeFilterCount > 0) {
    return [];
  }

  return input.listings.slice(0, DISCOVER_HERO_LISTING_LIMIT);
}

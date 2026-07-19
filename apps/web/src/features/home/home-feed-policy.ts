export const HOME_DESKTOP_INITIAL_LISTING_LIMIT = 4;
export const HOME_COMPACT_INITIAL_LISTING_LIMIT = 2;
export const HOME_DESKTOP_MIN_WIDTH = 1025;
export const HOME_LISTING_BATCH_SIZE = 16;
export const HOME_AUTO_STOP_LISTING_COUNT = 50;
export const HOME_LISTING_SENTINEL_ROOT_MARGIN = "180px 0px";

export function getHomeInitialListingLimit(viewportWidth: number): number {
  return viewportWidth >= HOME_DESKTOP_MIN_WIDTH
    ? HOME_DESKTOP_INITIAL_LISTING_LIMIT
    : HOME_COMPACT_INITIAL_LISTING_LIMIT;
}

export function getHomeAutoLoadRequestLimit(currentListingCount: number): number {
  const remaining = Math.max(0, HOME_AUTO_STOP_LISTING_COUNT - currentListingCount);

  return Math.min(HOME_LISTING_BATCH_SIZE, remaining);
}

export const HOME_INITIAL_LISTING_LIMIT = 20;
export const HOME_LISTING_BATCH_SIZE = 20;
export const HOME_LISTING_SENTINEL_ROOT_MARGIN = "240px 0px";

export function getHomeInitialListingLimit(_viewportWidth: number): number {
  return HOME_INITIAL_LISTING_LIMIT;
}

export function getHomeAutoLoadRequestLimit(_currentListingCount: number): number {
  return HOME_LISTING_BATCH_SIZE;
}

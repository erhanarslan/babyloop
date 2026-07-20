import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function mustContain(path, value) {
  const source = read(path);
  if (!source.includes(value)) {
    throw new Error(`${path} must contain ${JSON.stringify(value)}`);
  }
}

function mustNotContain(path, value) {
  const source = read(path);
  if (source.includes(value)) {
    throw new Error(`${path} must not contain ${JSON.stringify(value)}`);
  }
}

const browsePath = "apps/mobile/src/features/browse/browse-screen.tsx";
const virtualizedScreenPath = "apps/mobile/src/ui/mobile-virtualized-screen.tsx";
const listingsApiPath = "apps/mobile/src/features/listings/listings-api.ts";
const listingDetailPath = "apps/mobile/src/features/listings/listing-detail-screen.tsx";
const notificationScreenPath = "apps/mobile/src/features/notifications/notifications-screen.tsx";
const notificationApiRoutePath = "apps/api/src/routes/notifications.routes.ts";
const listingApiRoutePath = "apps/api/src/routes/listings.routes.ts";
const listingsServicePath = "apps/api/src/services/listings.service.ts";

mustContain(virtualizedScreenPath, "<FlatList");
mustContain(virtualizedScreenPath, "removeClippedSubviews");
mustContain(virtualizedScreenPath, "windowSize={7}");

mustContain(browsePath, "MobileVirtualizedScreen");
mustContain(browsePath, "fetchMobileListingsPage");
mustContain(browsePath, "new AbortController()");
mustContain(browsePath, "loadMoreInFlightRef.current");
mustContain(browsePath, "nextOffsetRef.current");
mustContain(browsePath, "includeTotal: mode !== \"append\"");
mustContain(browsePath, "onEndReached={handleLoadMore}");
mustNotContain(browsePath, "listings.map(");

mustContain(listingsApiPath, "offset?: number");
mustContain(listingsApiPath, "fetchMobileListingsPage");
mustContain(listingsApiPath, "viewerState");
mustContain(listingsApiPath, "mobileAuthFetch(`/api/v1/listings/");

mustContain(listingDetailPath, "nextListing.viewerState.isFavorited");
mustContain(listingDetailPath, "controller.abort()");
mustNotContain(listingDetailPath, "fetchMobileFavorites");

mustContain(notificationApiRoutePath, "unreadCount");
mustContain(notificationScreenPath, "notificationsResponse.data.unreadCount");
mustNotContain(notificationScreenPath, "fetchMobileUnreadNotificationCount");

mustContain(listingApiRoutePath, "currentUser?.profile.id ?? null");
mustContain(listingsServicePath, "isListingFavoritedByProfile");
mustContain(listingsServicePath, "isOwner");

console.log("Mobile marketplace pagination/viewer-state boundary passed.");

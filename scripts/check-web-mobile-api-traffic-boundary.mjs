import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function mustContain(path, value) {
  if (!read(path).includes(value)) {
    throw new Error(`${path} must contain ${JSON.stringify(value)}`);
  }
}

function mustNotContain(path, value) {
  if (read(path).includes(value)) {
    throw new Error(`${path} must not contain ${JSON.stringify(value)}`);
  }
}

const apiSchema = "apps/api/src/schemas/listings.schemas.ts";
const apiQueries = "apps/api/src/services/listing-queries.service.ts";
const apiListings = "apps/api/src/services/listings.service.ts";
const webBrowse = "apps/web/src/features/listings/browse-page-content.tsx";
const webRouting = "apps/web/src/features/listings/browse-routing.ts";
const webHomePolicy = "apps/web/src/features/home/home-feed-policy.ts";
const webHome = "apps/web/src/features/home/home-latest-listings-section.tsx";
const webMyListings = "apps/web/src/features/listings/my-listings-list.tsx";
const webServerData = "apps/web/src/features/listings/server-data.ts";
const mobileBrowse = "apps/mobile/src/features/browse/browse-screen.tsx";
const mobileListingsApi = "apps/mobile/src/features/listings/listings-api.ts";

mustContain(apiSchema, "includeTotal");
mustContain(apiListings, "limit: query.limit + 1");
mustContain(apiListings, "total: null");
mustContain(apiListings, "nextOffset");
mustContain(apiQueries, "desc(listings.createdAt), desc(listings.id)");
mustContain(apiQueries, "asc(listings.createdAt), asc(listings.id)");

mustContain(webRouting, "export const DEFAULT_LISTINGS_LIMIT = 20");
mustContain(webBrowse, "const BROWSE_PAGE_SIZE = 20");
mustContain(webBrowse, "new IntersectionObserver");
mustContain(webBrowse, "inFlightOffsetRef.current === nextOffset");
mustContain(webBrowse, "includeTotal=false");
mustNotContain(webBrowse, 'className="pagination-controls"');
mustContain(webServerData, "cache(async () =>");

mustContain(webHomePolicy, "HOME_INITIAL_LISTING_LIMIT = 20");
mustContain(webHomePolicy, "HOME_LISTING_BATCH_SIZE = 20");
mustContain(webHome, 'includeTotal: "false"');
mustContain(webHome, "loadMoreInFlightRef.current");
mustNotContain(webHomePolicy, "HOME_AUTO_STOP_LISTING_COUNT");

mustContain(webMyListings, "document.visibilityState");
mustContain(webMyListings, "document.hasFocus()");
mustContain(webMyListings, "refreshDelays = [7_000, 12_000, 20_000, 30_000]");
mustNotContain(webMyListings, "setInterval(");

mustContain(mobileBrowse, "const DISCOVER_PAGE_SIZE = 20");
mustContain(mobileBrowse, "loadMoreInFlightRef.current");
mustContain(mobileBrowse, "nextOffsetRef.current");
mustContain(mobileBrowse, 'includeTotal: mode !== "append"');
mustContain(mobileListingsApi, 'query.set("includeTotal", "false")');

console.log("Web/mobile API traffic and infinite-scroll boundary passed.");

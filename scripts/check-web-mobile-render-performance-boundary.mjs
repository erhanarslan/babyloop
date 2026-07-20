import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function requireTokens(path, tokens) {
  const source = read(path);

  for (const token of tokens) {
    if (!source.includes(token)) {
      throw new Error(`${path} is missing required render-performance token: ${token}`);
    }
  }
}

function forbidTokens(path, tokens) {
  const source = read(path);

  for (const token of tokens) {
    if (source.includes(token)) {
      throw new Error(`${path} contains forbidden render-performance token: ${token}`);
    }
  }
}

requireTokens("apps/api/src/schemas/listings.schemas.ts", [
  "imageLimit: z.coerce.number().int().min(1).max(3).optional().default(3)"
]);
requireTokens("apps/api/src/services/listings.service.ts", [
  "mapListingRows(app, rows, query.imageLimit)",
  "maxImagesPerListing = 5"
]);
requireTokens("apps/api/src/services/listing-queries.service.ts", [
  "maxImagesPerListing = 5",
  "normalizedImageLimit"
]);
requireTokens("apps/api/src/routes/categories.routes.ts", [
  'Cache-Control", "public, max-age=300, stale-while-revalidate=3600'
]);
requireTokens("apps/web/src/app/listings/[id]/page.tsx", [
  "const fetchPublicListingDetail = cache",
  "const result = await fetchPublicListingDetail(id)"
]);
requireTokens("apps/web/src/lib/use-page-visibility.ts", [
  "useSyncExternalStore",
  "listeners.size === 0"
]);
requireTokens("apps/web/src/features/listings/listing-image-frame.tsx", [
  "fetchPriority",
  "loading = \"lazy\"",
  "sizes"
]);
requireTokens("apps/web/src/features/listings/listing-hover-image-frame.tsx", [
  "usePageVisibility",
  "!isPageVisible"
]);
requireTokens("apps/mobile/src/features/sell/sell-api.ts", [
  "MOBILE_CATEGORY_CACHE_TTL_MS",
  "mobileCategoryRequest",
  "resetMobileCategoryCacheForTests"
]);
requireTokens("apps/mobile/src/features/listings/listings-api.ts", [
  'imageLimit: String(params.imageLimit ?? 1)'
]);
requireTokens("apps/mobile/src/ui/mobile-listing-card.tsx", [
  "memo(function MobileListingCard",
  "fadeDuration={0}",
  "resizeMethod={Platform.OS === \"android\" ? \"resize\" : \"auto\"}"
]);
requireTokens("apps/mobile/src/features/browse/browse-screen.tsx", [
  "BrowseListingRow = memo",
  "initialNumToRender={4}",
  "windowSize={5}",
  "keyboardAvoiding={false}"
]);
requireTokens("apps/mobile/src/features/messages/conversation-detail-screen.tsx", [
  "<FlatList",
  "ConversationMessageBubble = memo",
  "removeClippedSubviews={Platform.OS === \"android\"}"
]);
forbidTokens("apps/mobile/src/features/messages/conversation-detail-screen.tsx", [
  "<ScrollView",
  "messages.map((message)"
]);

console.log("Web/mobile render and payload performance boundary passed.");

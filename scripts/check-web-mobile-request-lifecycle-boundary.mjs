#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const problems = [];
const requiredFiles = [
  "apps/web/src/lib/auth-client.ts",
  "apps/web/src/features/auth/auth-form.tsx",
  "apps/web/src/features/auth/auth-action-prompt-modal.tsx",
  "apps/web/src/components/site-header.tsx",
  "apps/web/src/features/home/latest-listing-rotator.tsx",
  "apps/web/src/lib/use-page-visibility.ts",
  "apps/web/src/features/cart/api.ts",
  "apps/web/src/features/cart/use-header-cart-summary.ts",
  "apps/mobile/src/features/auth/auth-api.ts",
  "apps/mobile/src/features/messages/conversation-list-store.tsx",
  "apps/api/src/routes/cart.routes.ts",
  "apps/api/src/services/cart.service.ts",
  "packages/database/drizzle/0008_kind_texas_twister.sql",
  "scripts/audit-web-mobile-request-lifecycle.mjs",
  "docs/86-web-mobile-request-lifecycle-audit.md"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) problems.push(`Missing request-lifecycle file: ${file}`);
}

if (problems.length === 0) {
  const authClient = read("apps/web/src/lib/auth-client.ts");
  requireTokens("apps/web/src/lib/auth-client.ts", authClient, [
    "refreshSessionPromise",
    "fetchCurrentUserWithoutRefreshPromise",
    "CURRENT_AUTH_CACHE_TTL_MS",
    "cachedCurrentAuth",
    "setAuthPayload"
  ]);

  for (const file of [
    "apps/web/src/features/auth/auth-form.tsx",
    "apps/web/src/features/auth/auth-action-prompt-modal.tsx"
  ]) {
    const source = read(file);
    requireTokens(file, source, ["setAuthPayload("]);
    forbidTokens(file, source, ["setAuthToken(stage.auth.accessToken)", "setAuthToken(authPayload.accessToken)"]);
  }

  const header = read("apps/web/src/components/site-header.tsx");
  requireTokens("apps/web/src/components/site-header.tsx", header, [
    'import { useHeaderCartSummary } from "../features/cart/use-header-cart-summary";',
    "useHeaderCartSummary(apiBaseUrl, currentAuth?.user.id ?? null)"
  ]);
  forbidTokens("apps/web/src/components/site-header.tsx", header, [
    "fetchCart(apiBaseUrl)",
    "fetchCartSummary(",
    "body.data.summary.itemCount"
  ]);

  const headerCartSummary = read("apps/web/src/features/cart/use-header-cart-summary.ts");
  requireTokens("apps/web/src/features/cart/use-header-cart-summary.ts", headerCartSummary, [
    "if (!authenticatedUserId)",
    "fetchCartSummary(apiBaseUrl)",
    "body.data.summary.itemCount",
    "let isActive = true",
    "isActive = false",
    "window.addEventListener(CART_CHANGED_EVENT, loadCartCount)",
    "window.removeEventListener(CART_CHANGED_EVENT, loadCartCount)"
  ]);

  const rotator = read("apps/web/src/features/home/latest-listing-rotator.tsx");
  requireTokens("apps/web/src/features/home/latest-listing-rotator.tsx", rotator, [
    "new AbortController()",
    "usePageVisibility",
    "!isPageVisible"
  ]);

  const pageVisibility = read("apps/web/src/lib/use-page-visibility.ts");
  requireTokens("apps/web/src/lib/use-page-visibility.ts", pageVisibility, [
    "document.visibilityState",
    "visibilitychange",
    "useSyncExternalStore",
    "listeners.size === 0"
  ]);
  forbidTokens("apps/web/src/features/home/latest-listing-rotator.tsx", rotator, ["enrichListingWithCity", "/api/v1/listings/${listing.id}"]);

  const mobileAuth = read("apps/mobile/src/features/auth/auth-api.ts");
  requireTokens("apps/mobile/src/features/auth/auth-api.ts", mobileAuth, [
    "mobileAuthTokenHydrationPromise",
    "mobileSessionRefreshPromise",
    "publicCsrfTokenPromise"
  ]);

  const conversationStore = read("apps/mobile/src/features/messages/conversation-list-store.tsx");
  requireTokens("apps/mobile/src/features/messages/conversation-list-store.tsx", conversationStore, [
    "inFlightRef",
    "APP_RESUME_MAX_AGE_MS",
    "subscription.remove()",
    "unsubscribe?.()"
  ]);

  const migration = read("packages/database/drizzle/0008_kind_texas_twister.sql");
  requireTokens("packages/database/drizzle/0008_kind_texas_twister.sql", migration, [
    "RENAME TO \"listing_status_legacy\"",
    "CREATE TYPE \"public\".\"listing_status\" AS ENUM('draft', 'active', 'reserved', 'sold', 'archived')",
    "DROP TYPE \"public\".\"listing_status_legacy\""
  ]);
  forbidTokens("packages/database/drizzle/0008_kind_texas_twister.sql", migration, ["ADD VALUE"]);

  checkSocketPairs("apps/web/src/features/messaging/message-thread.tsx");
  checkSocketPairs("apps/web/src/features/messaging/conversation-list.tsx");
  checkSocketPairs("apps/web/src/features/notifications/notifications-page-content.tsx");
  checkSocketPairs("apps/web/src/components/site-header.tsx");

  for (const file of [
    "apps/web/src/lib/auth-client.ts",
    "apps/mobile/src/features/auth/auth-api.ts",
    "apps/web/src/features/cart/api.ts",
    "apps/mobile/src/features/messages/messages-api.ts"
  ]) {
    const source = read(file);
    if (/setInterval\s*\(/u.test(source)) {
      problems.push(`${file} must not start polling intervals inside API/auth transport modules.`);
    }
  }
}

if (problems.length) {
  console.error("Web/mobile request lifecycle boundary failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Web/mobile request lifecycle boundary passed.");

function read(file) {
  return readFileSync(file, "utf8");
}

function requireTokens(file, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function forbidTokens(file, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
  }
}

function checkSocketPairs(file) {
  const source = read(file);
  const onEvents = [...source.matchAll(/(?:socket|realtimeSocket)\.on\(([^,\n]+)/gu)].map((match) => match[1].trim());
  const offEvents = new Set([...source.matchAll(/(?:socket|realtimeSocket)\.off\(([^,\n]+)/gu)].map((match) => match[1].trim()));
  for (const event of onEvents) {
    if (!offEvents.has(event)) problems.push(`${file} registers socket event ${event} without a matching off().`);
  }
}

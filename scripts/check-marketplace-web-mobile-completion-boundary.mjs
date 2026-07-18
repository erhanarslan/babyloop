#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const problems = [];
const textExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".md", ".json", ".yaml", ".yml"]);
const ignoredDirs = new Set(["node_modules", ".next", "dist", "coverage", ".turbo", "playwright-report", "test-results"]);

function walk(dir) {
  const abs = join(root, dir);

  if (!existsSync(abs)) {
    return [];
  }

  const out = [];

  for (const entry of readdirSync(abs)) {
    if (ignoredDirs.has(entry)) {
      continue;
    }

    const full = join(abs, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      out.push(...walk(relative(root, full)));
      continue;
    }

    if (textExtensions.has(extname(entry))) {
      out.push(relative(root, full));
    }
  }

  return out;
}

function read(file) {
  return readFileSync(join(root, file), "utf8");
}

function lower(value) {
  return value.toLowerCase();
}

function corpus(files) {
  return files
    .filter((file) => existsSync(join(root, file)))
    .map((file) => `\n// FILE ${file}\n${read(file)}`)
    .join("\n");
}

function mustExist(file, label = file) {
  if (!existsSync(join(root, file))) {
    problems.push(`${label} is required.`);
  }
}

function mustContain(source, label, token) {
  if (!lower(source).includes(lower(token))) {
    problems.push(`${label} must contain ${JSON.stringify(token)}.`);
  }
}

function mustContainOne(source, label, tokens) {
  if (!tokens.some((token) => lower(source).includes(lower(token)))) {
    problems.push(`${label} must contain one of ${JSON.stringify(tokens)}.`);
  }
}

function mustNotMatch(source, label, pattern, description) {
  if (pattern.test(source)) {
    problems.push(`${label} must not contain ${description}.`);
  }
}

function isTestFile(file) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/u.test(file);
}

const requiredFiles = [
  "package.json",
  "scripts/run-beta-critical-smoke.mjs",
  "docs/78-marketplace-web-mobile-completion.md",
  "apps/api/src/routes/saved-searches.routes.ts",
  "apps/api/src/routes/seller-dashboard.routes.ts",
  "apps/api/src/routes/favorites.routes.ts",
  "apps/api/src/routes/messaging.routes.ts",
  "apps/api/src/routes/listings.routes.ts",
  "apps/api/src/routes/profiles.routes.ts",
  "apps/api/src/schemas/product-events.schemas.ts",
  "apps/api/src/services/product-events.service.ts",
  "apps/api/src/services/public-profiles.service.ts",
  "apps/api/test/saved-searches.routes.test.ts",
  "apps/api/test/seller-dashboard.routes.test.ts",
  "apps/api/test/favorites.integration.test.ts",
  "apps/api/test/listings.integration.test.ts",
  "apps/api/test/messaging.integration.test.ts",
  "apps/api/test/public-profiles.routes.test.ts",
  "apps/api/test/product-events.routes.test.ts",
  "apps/web/src/app/account/saved-searches/page.tsx",
  "apps/web/src/app/account/seller/page.tsx",
  "apps/web/src/app/profiles/[profileId]/page.tsx",
  "apps/web/src/app/assistant/page.tsx",
  "apps/web/src/app/robots.ts",
  "apps/web/src/app/sitemap.ts",
  "apps/web/src/app/opengraph-image.tsx",
  "apps/web/src/features/saved-searches/saved-searches-page-content.tsx",
  "apps/web/src/features/seller-dashboard/seller-dashboard-page-content.tsx",
  "apps/web/src/features/listings/browse-routing.ts",
  "apps/web/src/features/listings/browse-routing.test.ts",
  "apps/web/src/features/listings/listing-image-frame.tsx",
  "apps/web/src/features/listings/my-listings-list.tsx",
  "apps/web/src/features/favorites/favorites-list.tsx",
  "apps/web/src/features/favorites/favorite-card.test.tsx",
  "apps/web/src/features/messaging/message-thread.tsx",
  "apps/web/src/features/safety/block-profile-action.tsx",
  "apps/web/src/features/safety/report-action.tsx",
  "apps/web/src/features/assistant/assistant-page-content.tsx",
  "apps/web/src/features/home/home-latest-listings-section.tsx",
  "apps/web/src/features/home/home-latest-listings-section.test.tsx",
  "apps/web/src/features/home/home-personalization-feed.tsx",
  "apps/web/src/components/site-header.tsx",
  "apps/web/src/components/navigation/mobile-navigation-drawer.tsx",
  "apps/web/src/components/navigation/public-navigation-model.ts",
  "apps/web/src/lib/seo.ts",
  "apps/web/src/lib/seo.test.ts",
  "apps/web/e2e/browse.smoke.spec.ts",
  "apps/web/e2e/favorites.smoke.spec.ts",
  "apps/web/e2e/messaging-read-state.smoke.spec.ts",
  "apps/web/e2e/seller-dashboard.smoke.spec.ts",
  "apps/mobile/app/(tabs)/_layout.tsx",
  "apps/mobile/src/lib/android-navigation-bar.ts",
  "apps/mobile/src/ui/mobile-layout.ts",
  "apps/mobile/src/features/browse/browse-screen.tsx",
  "apps/mobile/src/features/listings/listing-detail-screen.tsx",
  "apps/mobile/src/features/listings/listings-api.ts",
  "apps/mobile/src/features/sell/sell-api.ts",
  "apps/mobile/src/features/sell/sell-screen.tsx",
  "apps/mobile/src/features/sell/image-upload-model.ts",
  "apps/mobile/src/features/sell/image-upload-model.test.ts",
  "apps/mobile/src/features/favorites/favorites-api.ts",
  "apps/mobile/src/features/favorites/favorites-screen.tsx",
  "apps/mobile/src/features/messages/messages-api.ts",
  "apps/mobile/src/features/messages/messages-realtime-model.ts",
  "apps/mobile/src/features/messages/messages-realtime-model.test.ts",
  "apps/mobile/src/features/notifications/notifications-api.ts",
  "apps/mobile/src/features/notifications/notifications-screen.tsx",
  "apps/mobile/src/features/notifications/notification-preferences-model.ts",
  "apps/mobile/src/features/notifications/notification-preferences-model.test.ts",
  "apps/mobile/src/features/child/child-reminders-api.ts",
  "apps/mobile/src/features/child/child-reminder-screen-state-model.ts",
  "apps/mobile/src/features/security/security-model.ts",
  "apps/mobile/README.md"
];

for (const file of requiredFiles) {
  mustExist(file);
}

if (problems.length === 0) {
  checkPackageScripts();
  checkBetaRunner();
  checkDocs();
  checkMarketplace();
  checkWebFunctional();
  checkMobileFunctional();
  checkSeoAndSafety();
  checkNoLeakPatterns();
}

function checkPackageScripts() {
  const scripts = JSON.parse(read("package.json")).scripts ?? {};

  mustContain(
    scripts["security:marketplace-web-mobile-completion"] ?? "",
    "package.json#security:marketplace-web-mobile-completion",
    "node scripts/check-marketplace-web-mobile-completion-boundary.mjs"
  );
  mustContain(
    scripts["test:api:security"] ?? "",
    "package.json#test:api:security",
    "pnpm security:marketplace-web-mobile-completion"
  );
  mustContain(
    scripts["release:mobile:p0"] ?? "",
    "package.json#release:mobile:p0",
    "pnpm security:marketplace-web-mobile-completion"
  );
}

function checkBetaRunner() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Marketplace web mobile completion guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:marketplace-web-mobile-completion");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "const steps = [");
}

function checkDocs() {
  const docs = read("docs/78-marketplace-web-mobile-completion.md");

  for (const item of [
    "#204", "#205", "#206", "#207", "#208", "#209", "#210", "#211", "#212", "#213",
    "#214", "#215", "#216", "#217", "#218", "#219", "#220", "#221", "#222", "#223",
    "#224", "#225", "#226", "#227", "#228", "#229", "#230", "#231", "#232", "#233",
    "#234", "#235", "#236", "#237", "#238", "#239", "#240", "#241", "#242", "#243",
    "#244", "#245", "#246", "#247", "#248", "#249", "#250", "#251", "#252", "#264"
  ]) {
    mustContain(docs, "docs/78-marketplace-web-mobile-completion.md backlog coverage", item);
  }

  for (const token of [
    "No real email send",
    "No real push send",
    "No real n8n webhook execution",
    "No real queue worker",
    "No real payment/Iyzico",
    "No real S3/R2 migration",
    "S22/Maestro real-device smoke deferred",
    "Codex did not run tests"
  ]) {
    mustContain(docs, "docs/78-marketplace-web-mobile-completion.md", token);
  }
}

function checkMarketplace() {
  const marketplace = corpus([
    "apps/api/src/routes/saved-searches.routes.ts",
    "apps/api/src/routes/seller-dashboard.routes.ts",
    "apps/api/src/routes/listings.routes.ts",
    "apps/api/src/routes/favorites.routes.ts",
    "apps/api/src/routes/messaging.routes.ts",
    "apps/api/src/routes/profiles.routes.ts",
    "apps/api/src/services/public-profiles.service.ts",
    "apps/api/src/schemas/listings.schemas.ts",
    "apps/api/src/schemas/product-events.schemas.ts",
    "apps/api/src/services/product-events.service.ts",
    "apps/api/test/saved-searches.routes.test.ts",
    "apps/api/test/seller-dashboard.routes.test.ts",
    "apps/api/test/listings.integration.test.ts",
    "apps/api/test/listing-image-authenticity.integration.test.ts",
    "apps/api/test/favorites.integration.test.ts",
    "apps/api/test/messaging.integration.test.ts",
    "apps/api/test/public-profiles.routes.test.ts",
    "apps/api/test/product-events.routes.test.ts",
    "docs/78-marketplace-web-mobile-completion.md"
  ]);

  for (const token of [
    "/saved-searches",
    "owner-only",
    "/seller/dashboard",
    "active",
    "reserved",
    "sold",
    "archived",
    "reorderListingImages",
    "deleteListingImage",
    "needs_review",
    "price_asc",
    "price_desc",
    "limit",
    "offset",
    "locationCity",
    "safe seller",
    "favorite_added",
    "favorite_removed",
    "listing_status_changed",
    "browse_filter_applied",
    "message_sent"
  ]) {
    mustContain(marketplace, "marketplace completion inventory", token);
  }

  mustContainOne(marketplace, "profile safety status behavior", ["suspended", "restricted", "profile_not_allowed"]);
  mustContainOne(marketplace, "report/block hidden menu inventory", ["block", "report", "hidden"]);
}

function checkWebFunctional() {
  const web = corpus([
    "apps/web/src/components/site-header.tsx",
    "apps/web/src/components/navigation/mobile-navigation-drawer.tsx",
    "apps/web/src/components/navigation/public-navigation-model.ts",
    "apps/web/src/features/saved-searches/saved-searches-page-content.tsx",
    "apps/web/src/features/seller-dashboard/seller-dashboard-page-content.tsx",
    "apps/web/src/features/listings/browse-routing.ts",
    "apps/web/src/features/listings/browse-page-content.tsx",
    "apps/web/src/features/listings/listing-detail-content.tsx",
    "apps/web/src/features/listings/listing-image-frame.tsx",
    "apps/web/src/features/listings/my-listings-list.tsx",
    "apps/web/src/features/favorites/favorites-list.tsx",
    "apps/web/src/features/messaging/message-thread.tsx",
    "apps/web/src/features/assistant/assistant-page-content.tsx",
    "apps/web/src/features/home/home-latest-listings-section.tsx",
    "apps/web/src/features/home/home-personalization-feed.tsx",
    "apps/web/src/features/child-profiles/child-profiles-page-content.tsx",
    "apps/web/src/features/notification-preferences/notification-preferences-page-content.tsx",
    "apps/web/src/lib/seo.ts",
    "apps/api/src/schemas/assistant.schemas.ts"
  ]);

  for (const token of [
    "MobileNavigationDrawer",
    "saved-searches",
    "seller-dashboard",
    "empty",
    "loading",
    "error",
    "aria-label",
    "focus",
    "assistant",
    "safe_buying",
    "notes",
    "reminders",
    "listing-image",
    "loadMoreListings",
    "home feed"
  ]) {
    mustContain(web, "web functional completion inventory", token);
  }

  mustContainOne(web, "web user menu/profile/settings IA", ["notification-preferences", "profile", "security"]);
}

function checkMobileFunctional() {
  const mobile = corpus([
    "apps/mobile/app/(tabs)/_layout.tsx",
    "apps/mobile/src/lib/android-navigation-bar.ts",
    "apps/mobile/src/ui/mobile-layout.ts",
    "apps/mobile/src/features/browse/browse-screen.tsx",
    "apps/mobile/src/features/listings/listing-detail-screen.tsx",
    "apps/mobile/src/features/listings/listings-api.ts",
    "apps/mobile/src/features/sell/sell-api.ts",
    "apps/mobile/src/features/sell/sell-screen.tsx",
    "apps/mobile/src/features/sell/image-upload-model.ts",
    "apps/mobile/src/features/favorites/favorites-api.ts",
    "apps/mobile/src/features/favorites/favorites-screen.tsx",
    "apps/mobile/src/features/messages/messages-api.ts",
    "apps/mobile/src/features/messages/messages-realtime-model.ts",
    "apps/mobile/src/features/notifications/notifications-api.ts",
    "apps/mobile/src/features/notifications/notifications-screen.tsx",
    "apps/mobile/src/features/notifications/notification-preferences-model.ts",
    "apps/mobile/src/features/child/child-reminders-api.ts",
    "apps/mobile/src/features/child/child-reminder-screen-state-model.ts",
    "apps/mobile/src/features/security/security-model.ts",
    "apps/mobile/app/(tabs)/security.tsx",
    "apps/mobile/README.md",
    "docs/78-marketplace-web-mobile-completion.md"
  ]);

  for (const token of [
    "tabBarHideOnKeyboard",
    "getAndroidAwareBottomOffset",
    "categoryId",
    "listingType",
    "favorite",
    "message",
    "report",
    "block",
    "uploadMobileListingImage",
    "handleRemoveImage",
    "allowedImageTypes",
    "notifications",
    "notification-preferences",
    "child-profiles",
    "reminders",
    "SecureStore",
    "security",
    "S22"
  ]) {
    mustContain(mobile, "mobile functional completion inventory", token);
  }

  mustContainOne(mobile, "mobile bottom tab icon inventory", ["Ionicons", "heart", "chatbubble", "cart"]);
}

function checkSeoAndSafety() {
  const seo = corpus([
    "apps/web/src/app/robots.ts",
    "apps/web/src/app/sitemap.ts",
    "apps/web/src/app/opengraph-image.tsx",
    "apps/web/src/lib/seo.ts",
    "apps/web/src/lib/seo.test.ts",
    "docs/78-marketplace-web-mobile-completion.md"
  ]);

  for (const token of ["robots", "sitemap", "openGraph", "category", "listing", "profile", "private"]) {
    mustContain(seo, "SEO-lite readiness inventory", token);
  }

  const providerBoundary = corpus([
    "docs/78-marketplace-web-mobile-completion.md",
    "apps/api/src/services/notification-delivery-drafts.service.ts",
    "apps/api/src/services/notification-preferences.service.ts"
  ]);

  for (const token of [
    "No real email send",
    "No real push send",
    "No real n8n webhook execution",
    "No real queue worker",
    "No real payment/Iyzico",
    "No real S3/R2 migration"
  ]) {
    mustContain(providerBoundary, "provider/payment/storage disabled boundary", token);
  }
}

function checkNoLeakPatterns() {
  const productionFiles = walk("apps")
    .concat(walk("packages"))
    .filter((file) => !isTestFile(file))
    .filter((file) => !file.includes("/test/") && !file.includes("/e2e/"));
  const production = corpus(productionFiles);

  mustNotMatch(
    production,
    "production token persistence boundary",
    /\b(?:localStorage|sessionStorage|AsyncStorage)\s*\.\s*(?:setItem|multiSet)\s*\([^)]*(?:accessToken|refreshToken|token|authorization)/iu,
    "browser/native token persistence outside SecureStore"
  );
  mustNotMatch(
    production,
    "production cookie mutation boundary",
    /document\s*\.\s*cookie\s*=/iu,
    "document.cookie assignment"
  );
  mustNotMatch(
    production,
    "production sensitive logging boundary",
    /console\.(?:log|debug|info|warn|error)\s*\([^)]*(?:accessToken|refreshToken|passwordHash|authorization|providerSecret|webhookSecret|pushToken|rawMessageBody)/iu,
    "sensitive console logging"
  );

  const defaultDtoCorpus = corpus([
    "apps/api/src/services/public-profiles.service.ts",
    "apps/api/src/services/listing-response.mapper.ts",
    "apps/api/src/services/messaging.service.ts",
    "apps/api/src/services/notifications.service.ts",
    "apps/web/src/features/profiles/api.ts",
    "apps/mobile/src/features/listings/listings-api.ts",
    "apps/mobile/src/features/notifications/notifications-api.ts",
    "docs/78-marketplace-web-mobile-completion.md"
  ]);

  for (const token of ["passwordHash", "refreshToken", "accessToken", "raw message body", "provider secret", "webhook secret"]) {
    mustContain(defaultDtoCorpus, "public/admin DTO no-leak checklist", token);
  }
}

if (problems.length > 0) {
  console.error("Marketplace web mobile completion boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Marketplace web mobile completion boundary passed.");

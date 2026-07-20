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

function corpus(files) {
  return files
    .filter((file) => existsSync(join(root, file)))
    .map((file) => `\n// FILE ${file}\n${read(file)}`)
    .join("\n");
}

function lower(value) {
  return value.toLowerCase();
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
  "docs/77-notification-marketplace-core.md",
  "packages/database/src/schema/index.ts",
  "packages/database/drizzle/0025_notification_preferences.sql",
  "apps/api/src/schemas/notification-preferences.schemas.ts",
  "apps/api/src/services/notification-email-config.service.ts",
  "apps/api/src/services/notification-preferences.service.ts",
  "apps/api/src/services/notification-consent-preference-policy.service.ts",
  "apps/api/src/services/notification-delivery-drafts.service.ts",
  "apps/api/src/services/saved-search-delivery-candidates.service.ts",
  "apps/api/src/services/saved-search-notifications.service.ts",
  "apps/api/src/services/child-lifecycle-notifications.service.ts",
  "apps/api/src/routes/notifications.routes.ts",
  "apps/api/src/routes/saved-searches.routes.ts",
  "apps/api/src/routes/seller-dashboard.routes.ts",
  "apps/api/src/routes/profiles.routes.ts",
  "apps/api/src/services/public-profiles.service.ts",
  "apps/api/test/notification-preferences.routes.test.ts",
  "apps/api/test/notification-provider-config.service.test.ts",
  "apps/api/test/public-profiles.routes.test.ts",
  "apps/api/test/saved-searches.routes.test.ts",
  "apps/api/test/seller-dashboard.routes.test.ts",
  "apps/api/test/product-events.routes.test.ts",
  "apps/api/test/listings.integration.test.ts",
  "apps/api/test/listing-image-authenticity.integration.test.ts",
  "apps/web/src/app/account/saved-searches/page.tsx",
  "apps/web/src/features/saved-searches/saved-searches-page-content.tsx",
  "apps/web/src/features/notification-preferences/api.ts",
  "apps/web/src/features/notification-preferences/notification-preferences-page-content.tsx",
  "apps/web/src/features/seller-dashboard/seller-dashboard-page-content.tsx",
  "apps/web/src/app/profiles/[profileId]/page.tsx",
  "apps/web/src/features/profiles/api.ts",
  "apps/web/e2e/browse.smoke.spec.ts",
  "apps/web/e2e/favorites.smoke.spec.ts",
  "apps/web/e2e/messaging-read-state.smoke.spec.ts",
  "apps/web/e2e/seller-dashboard.smoke.spec.ts",
  "apps/mobile/src/features/notifications/notifications-api.ts",
  "apps/mobile/src/features/notifications/notification-preferences-model.ts",
  "apps/mobile/src/features/notifications/notification-preferences-model.test.ts",
  "apps/mobile/src/features/favorites/favorites-api.ts",
  "apps/mobile/src/features/favorites/favorites-screen.tsx",
  "apps/mobile/src/features/messages/messages-realtime-model.test.ts"
];

for (const file of requiredFiles) {
  mustExist(file);
}

if (problems.length === 0) {
  checkPackageScripts();
  checkBetaRunner();
  checkDocs();
  checkNotificationPreferences();
  checkProviderSandbox();
  checkMarketplaceCoreInventory();
  checkPublicSellerProfile();
  checkNoLeakBoundaries();
}

function checkPackageScripts() {
  const scripts = JSON.parse(read("package.json")).scripts ?? {};

  mustContain(
    scripts["security:notification-marketplace-core"] ?? "",
    "package.json#security:notification-marketplace-core",
    "node scripts/check-notification-marketplace-core-boundary.mjs"
  );
  mustContain(
    scripts["test:api:security"] ?? "",
    "package.json#test:api:security",
    "pnpm security:notification-marketplace-core"
  );
}

function checkBetaRunner() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Notification marketplace core guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:notification-marketplace-core");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "const steps = [");
}

function checkDocs() {
  const docs = read("docs/77-notification-marketplace-core.md");

  for (const item of [
    "#193",
    "#194",
    "#198",
    "#199",
    "#200",
    "#201",
    "#202",
    "#203",
    "#204",
    "#205",
    "#206",
    "#207",
    "#208",
    "#209",
    "#210",
    "#211",
    "#212",
    "#213",
    "#214",
    "#215",
    "#216",
    "#217",
    "#218",
    "#219",
    "#220",
    "#221",
    "#222",
    "#223"
  ]) {
    mustContain(docs, "docs/77-notification-marketplace-core.md backlog coverage", item);
  }

  mustContain(docs, "docs/77-notification-marketplace-core.md", "Codex did not run tests");
  mustContain(
    docs,
    "docs/77-notification-marketplace-core.md",
    "No external provider call is made with the default configuration"
  );
  mustContain(docs, "docs/77-notification-marketplace-core.md", "disabled by default");
  mustContain(docs, "docs/77-notification-marketplace-core.md", "env-gated");
}

function checkNotificationPreferences() {
  const schema = read("packages/database/src/schema/index.ts");
  const migration = read("packages/database/drizzle/0025_notification_preferences.sql");
  const apiSchema = read("apps/api/src/schemas/notification-preferences.schemas.ts");
  const service = read("apps/api/src/services/notification-preferences.service.ts");
  const providerConfig = read("apps/api/src/services/notification-email-config.service.ts");
  const route = read("apps/api/src/routes/notifications.routes.ts");
  const tests = read("apps/api/test/notification-preferences.routes.test.ts");
  const providerTests = read("apps/api/test/notification-provider-config.service.test.ts");

  for (const token of [
    "notificationPreferences",
    "notificationPreferenceAuditEvents",
    "notificationPreferenceSourceEnum",
    "notificationPreferenceChannelEnum"
  ]) {
    mustContain(schema, "database notification preference schema", token);
  }

  for (const token of [
    "notification_preferences",
    "notification_preference_audit_events",
    "child_reminder",
    "saved_search",
    "child_lifecycle",
    "marketplace",
    "messages",
    "trust_safety",
    "in_app",
    "email",
    "push",
    "n8n"
  ]) {
    mustContain(migration + apiSchema, "notification preference migration/schema", token);
  }

  mustContain(service, "notification preference service", "redactPrivateText");
  mustContain(service, "notification preference service", "isNotificationEmailProviderConfigured");
  mustContain(service, "notification preference service", "deliveryProvidersEnabled: anyProviderEnabled");
  mustContain(service, "notification preference service", "providerCallAllowed");
  mustContain(service, "notification preference service", "isNotificationPreferenceEnabledForDelivery");
  mustContain(providerConfig, "notification email provider configuration", "NOTIFICATION_EMAIL_ENABLED");
  mustContain(providerConfig, "notification email provider configuration", "RESEND_API_KEY");
  mustContain(providerConfig, "notification email provider configuration", "Boolean(apiKey)");
  mustContain(providerConfig, "notification email provider configuration", "Boolean(fromEmail)");
  mustContain(route, "notification preference route", "/notification-preferences");
  mustContain(tests, "notification preference route tests", "rejects invalid source/channel values and unknown fields");
  mustContain(tests, "notification preference route tests", "redacted audit event");
  mustContain(tests, "notification preference route tests", "providerCallAllowed");
  mustContain(providerTests, "notification provider configuration tests", "requires every Resend email gate");
  mustContain(providerTests, "notification provider configuration tests", "deliveryProvidersEnabled: true");
  mustContain(providerTests, "notification provider configuration tests", "RESEND_API_KEY: \"\"");
}

function checkProviderSandbox() {
  const providerBoundary = corpus([
    "apps/api/src/services/notification-consent-preference-policy.service.ts",
    "apps/api/src/services/notification-delivery-drafts.service.ts",
    "apps/api/src/services/notification-preferences.service.ts",
    "apps/mobile/src/features/notifications/notification-preferences-model.ts",
    "docs/77-notification-marketplace-core.md"
  ]);

  mustContain(providerBoundary, "provider sandbox boundary", "providerCallsAllowed: false");
  mustContain(providerBoundary, "provider sandbox boundary", "draftOnlyChannels");
  mustContain(providerBoundary, "provider sandbox boundary", "email");
  mustContain(providerBoundary, "provider sandbox boundary", "push");
  mustContain(providerBoundary, "provider sandbox boundary", "n8n");
  mustNotMatch(providerBoundary, "provider sandbox boundary", /send(?:Email|Push)\s*\(/u, "real email/push send call");
  mustNotMatch(providerBoundary, "provider sandbox boundary", /fetch\s*\([^)]*n8n/iu, "real n8n webhook call");
}

function checkMarketplaceCoreInventory() {
  const marketplace = corpus([
    "apps/web/src/features/saved-searches/saved-searches-page-content.tsx",
    "apps/api/test/saved-searches.routes.test.ts",
    "apps/api/src/routes/seller-dashboard.routes.ts",
    "apps/api/src/services/seller-dashboard.service.ts",
    "apps/web/src/features/seller-dashboard/seller-dashboard-page-content.tsx",
    "apps/api/test/seller-dashboard.routes.test.ts",
    "apps/api/test/listings.integration.test.ts",
    "apps/api/test/listing-image-authenticity.integration.test.ts",
    "apps/web/e2e/browse.smoke.spec.ts",
    "apps/web/e2e/favorites.smoke.spec.ts",
    "apps/web/e2e/messaging-read-state.smoke.spec.ts",
    "apps/mobile/src/features/favorites/favorites-api.ts",
    "apps/mobile/src/features/favorites/favorites-screen.tsx",
    "apps/mobile/src/features/messages/messages-realtime-model.test.ts",
    "apps/web/src/features/safety/block-profile-action.tsx",
    "apps/web/src/features/safety/report-action.tsx",
    "apps/api/test/product-events.routes.test.ts"
  ]);

  mustContain(marketplace, "saved searches web/API inventory", "SavedSearch");
  mustContain(marketplace, "saved searches negative/security inventory", "unknown fields");
  mustContain(marketplace, "seller dashboard inventory", "SellerDashboard");
  mustContain(marketplace, "listing status management inventory", "sold");
  mustContain(marketplace, "listing status management inventory", "reserved");
  mustContain(marketplace, "listing edit/image inventory", "image");
  mustContainOne(marketplace, "browse/search pagination inventory", ["pagination", "offset", "sort"]);
  mustContainOne(marketplace, "location/city inventory", ["locationCity", "city"]);
  mustContainOne(marketplace, "category landing inventory", ["categories/[slug]", "category"]);
  mustContain(marketplace, "favorites inventory", "favorites");
  mustContainOne(marketplace, "messaging read-state inventory", ["read-state", "unread", "mark"]);
  mustContainOne(marketplace, "report/block hidden menu inventory", ["block", "report", "Safety"]);
  mustContainOne(marketplace, "product analytics inventory", ["product", "event", "analytics"]);
}

function checkPublicSellerProfile() {
  const api = corpus([
    "apps/api/src/routes/profiles.routes.ts",
    "apps/api/src/services/public-profiles.service.ts",
    "apps/api/test/public-profiles.routes.test.ts"
  ]);
  const web = corpus([
    "apps/web/src/app/profiles/[profileId]/page.tsx",
    "apps/web/src/features/profiles/api.ts"
  ]);

  mustContain(api + web, "public seller profile safe summary", "displayName");
  mustContain(api + web, "public seller profile safe summary", "locationCity");
  mustContain(api + web, "public seller profile safe summary", "activeListingCount");
  mustContain(api + web, "public seller profile safe summary", "safetyStatus");
  mustContain(api, "public seller profile no-leak test", "not.toContain");
  mustContain(api, "public seller profile no-leak test", "passwordHash");
}

function checkNoLeakBoundaries() {
  const selectedFiles = [
    ...walk("apps/api/src/routes"),
    ...walk("apps/api/src/services"),
    ...walk("apps/web/src/features"),
    ...walk("apps/mobile/src/features"),
    ...walk("apps/backoffice/src/features")
  ];

  for (const file of selectedFiles.filter((file) => !isTestFile(file))) {
    const source = read(file);

    mustNotMatch(
      source,
      file,
      /console\.(log|debug|info|warn|error)\s*\([^)]*(accessToken|refreshToken|passwordHash|authorization|cookie|otp|providerSecret|webhookSecret|pushToken)/iu,
      "sensitive console logging"
    );
    mustNotMatch(
      source,
      file,
      /\bAsyncStorage\.(?:setItem|multiSet)\s*\([^)]*(?:accessToken|refreshToken|token)/iu,
      "AsyncStorage token persistence"
    );
    mustNotMatch(
      source,
      file,
      /\blocalStorage\.setItem\s*\([^)]*(?:accessToken|refreshToken|token)/iu,
      "localStorage token persistence"
    );
    mustNotMatch(
      source,
      file,
      /\bsessionStorage\.setItem\s*\([^)]*(?:accessToken|refreshToken|token)/iu,
      "sessionStorage token persistence"
    );
    mustNotMatch(source, file, /document\.cookie\s*=/iu, "document.cookie token write");
  }
}

if (problems.length > 0) {
  console.error("Notification marketplace core boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification marketplace core boundary passed.");

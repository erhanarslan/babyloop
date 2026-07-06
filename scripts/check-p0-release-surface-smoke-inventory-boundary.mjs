#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const problems = [];
const textExt = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".md", ".json", ".yaml", ".yml"]);

function walk(dir) {
  const abs = join(root, dir);

  if (!existsSync(abs)) {
    return [];
  }

  const out = [];

  for (const entry of readdirSync(abs)) {
    if (["node_modules", ".next", "dist", "coverage", ".turbo", "playwright-report", "test-results"].includes(entry)) {
      continue;
    }

    const full = join(abs, entry);
    const st = statSync(full);

    if (st.isDirectory()) {
      out.push(...walk(relative(root, full)));
      continue;
    }

    if (textExt.has(extname(entry))) {
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

const requiredFiles = [
  "package.json",
  "scripts/run-beta-critical-smoke.mjs",
  "docs/75-p0-release-surface-smoke-inventory.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-real-device-s22-qa-checklist.md",
  "docs/56-mobile-scope-freeze.md",
  "docs/70-notification-surface-consistency-audit.md",
  "docs/71-public-safety-abuse-flow-boundary.md",
  "docs/72-auth-session-realtime-readstate-boundary.md",
  "docs/73-mobile-messaging-realtime-parity-boundary.md",
  "docs/74-mobile-otp-mfa-session-regression-boundary.md"
];

for (const file of requiredFiles) {
  mustExist(file);
}

const mobileInventoryFiles = [
  "apps/mobile/src/features/notifications/notifications-api.test.ts",
  "apps/mobile/src/features/notifications/notifications-model.test.ts",
  "apps/mobile/src/features/notifications/notification-preferences-model.test.ts",
  "apps/mobile/src/features/child/child-reminders-api.test.ts",
  "apps/mobile/src/features/child/child-reminders-model.test.ts",
  "apps/mobile/src/features/child/child-reminder-screen-state-model.test.ts",
  "apps/mobile/src/features/sell/sell-form-model.test.ts",
  "apps/mobile/src/features/sell/image-upload-model.test.ts",
  "apps/mobile/src/features/listings/my-listings-model.test.ts",
  "apps/mobile/src/features/listings/listing-labels.test.ts",
  "apps/mobile/src/ui/mobile-listing-card.test.ts",
  "apps/mobile/src/features/basket/basket-api.test.ts",
  "apps/mobile/src/features/messages/messages-realtime-model.test.ts",
  "apps/mobile/src/features/auth/auth-token-storage.ts",
  "apps/mobile/.maestro/app-smoke.yaml",
  "apps/mobile/.maestro/basket-assistant-smoke.yaml"
];

const webInventoryFiles = [
  "apps/web/e2e/auth-session.smoke.spec.ts",
  "apps/web/e2e/browse.smoke.spec.ts",
  "apps/web/e2e/favorites.smoke.spec.ts",
  "apps/web/e2e/listing-detail.smoke.spec.ts",
  "apps/web/e2e/messaging.smoke.spec.ts",
  "apps/web/e2e/messaging-read-state.smoke.spec.ts",
  "apps/web/e2e/messaging-safety.smoke.spec.ts",
  "apps/web/e2e/sell-upload.smoke.spec.ts",
  "apps/web/e2e/helpers/web-e2e-api.ts",
  "apps/web/src/lib/auth-client.ts",
  "apps/web/src/components/navigation/search-overlay.test.tsx",
  "apps/web/src/features/listings/browse-routing.test.ts",
  "apps/web/src/features/favorites/favorite-card.test.tsx",
  "apps/web/src/features/safety/block-profile-action.test.tsx",
  "apps/web/src/features/messaging/conversation-card.test.tsx"
];

const backofficeInventoryFiles = [
  "apps/backoffice/e2e/login.smoke.spec.ts",
  "apps/backoffice/e2e/protected-auth-shell.smoke.spec.ts",
  "apps/backoffice/e2e/listing-image-review.smoke.spec.ts",
  "apps/backoffice/e2e/moderation-case.smoke.spec.ts",
  "apps/backoffice/e2e/trust-ops.smoke.spec.ts",
  "apps/backoffice/src/features/shell/backoffice-shell.test.tsx",
  "apps/backoffice/src/features/storage/storage-ops-page.test.tsx",
  "apps/backoffice/src/features/notifications/notification-ops-page.test.tsx",
  "apps/backoffice/src/features/conversations/conversation-admin-list.tsx",
  "apps/backoffice/src/features/conversations/conversation-admin-detail.tsx",
  "apps/backoffice/src/features/moderation/sensitive-access-panel.tsx",
  "apps/backoffice/src/features/listings/listing-image-review-panel.tsx"
];

const apiInventoryFiles = [
  "apps/api/test/auth.integration.test.ts",
  "apps/api/test/auth-security-edge-cases.test.ts",
  "apps/api/test/backoffice-csrf.test.ts",
  "apps/api/test/backoffice-permissions.test.ts",
  "apps/api/test/listings.integration.test.ts",
  "apps/api/test/listing-image-authenticity.integration.test.ts",
  "apps/api/test/listing-image-duplicates.integration.test.ts",
  "apps/api/test/messaging.integration.test.ts",
  "apps/api/test/notifications.integration.test.ts",
  "apps/api/test/favorites.integration.test.ts",
  "apps/api/test/safety.integration.test.ts",
  "apps/api/test/admin-moderation.integration.test.ts",
  "apps/api/test/admin-conversations.schemas.test.ts",
  "apps/api/test/admin-listings.schemas.test.ts",
  "apps/api/test/admin-sensitive-access-audit.service.test.ts",
  "apps/api/test/redaction.service.test.ts",
  "apps/api/test/helpers/db.ts",
  "packages/database/src/seed.ts"
];

for (const file of [...mobileInventoryFiles, ...webInventoryFiles, ...backofficeInventoryFiles, ...apiInventoryFiles]) {
  mustExist(file, `P0 smoke inventory file ${file}`);
}

if (problems.length === 0) {
  checkPackageScripts();
  checkBetaRunner();
  checkMobileInventory();
  checkWebInventory();
  checkBackofficeInventory();
  checkApiInventory();
  checkDocsInventory();
  checkNoLeakAndProviderBoundaries();
}

function checkPackageScripts() {
  const pkg = JSON.parse(read("package.json"));
  const scripts = pkg.scripts ?? {};

  mustContain(
    scripts["security:p0-release-surface-smoke-inventory"] ?? "",
    "package.json#security:p0-release-surface-smoke-inventory",
    "node scripts/check-p0-release-surface-smoke-inventory-boundary.mjs"
  );

  mustContain(
    scripts["test:api:security"] ?? "",
    "package.json#test:api:security",
    "pnpm security:p0-release-surface-smoke-inventory"
  );

  mustContain(
    scripts["release:mobile:p0"] ?? "",
    "package.json#release:mobile:p0",
    "pnpm security:p0-release-surface-smoke-inventory"
  );

  mustContain(
    scripts["beta:critical-smoke"] ?? "",
    "package.json#beta:critical-smoke",
    "node scripts/run-beta-critical-smoke.mjs"
  );
}

function checkBetaRunner() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "P0 release surface smoke inventory guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:p0-release-surface-smoke-inventory");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "const steps = [");
}

function checkMobileInventory() {
  const mobileFiles = walk("apps/mobile/src");
  const mobileTests = corpus(mobileInventoryFiles.filter((file) => file.includes(".test.")));
  const mobileSrc = corpus(mobileFiles);
  const mobileDocs = corpus([
    "docs/56-mobile-scope-freeze.md",
    "docs/56-mobile-real-device-s22-qa-checklist.md",
    "docs/75-p0-release-surface-smoke-inventory.md"
  ]);

  for (const token of ["SecureStore", "setItemAsync", "getItemAsync", "deleteItemAsync"]) {
    mustContain(mobileSrc + mobileTests + mobileDocs, "mobile SecureStore boundary", token);
  }

  mustContain(mobileTests, "mobile notification preferences inventory", "notification preference");
  mustContain(mobileTests, "mobile notification API inventory", "/api/v1/notifications");
  mustContain(mobileTests, "mobile child reminders API inventory", "/api/v1/child-profiles");
  mustContain(mobileTests, "mobile listing image upload inventory", "image upload");
  mustContainOne(mobileTests + mobileDocs, "mobile listing create/edit inventory", ["sell form", "my listings", "listing labels"]);
  mustContainOne(mobileTests + mobileDocs, "mobile favorites/browse/detail inventory", ["favorite", "listing card", "browse", "detail"]);
  mustContain(mobileDocs, "mobile real-device deferred docs", "#137");
  mustContain(mobileDocs, "mobile real-device deferred docs", "Real-device S22/Maestro deferred");

  for (const file of mobileFiles) {
    const source = read(file);

    mustNotMatch(source, file, /\bAsyncStorage\b[\s\S]{0,120}\b(accessToken|refreshToken|token)\b/iu, "AsyncStorage token persistence");
    mustNotMatch(source, file, /\blocalStorage\b/iu, "localStorage usage in mobile source");
    mustNotMatch(source, file, /\bsessionStorage\b/iu, "sessionStorage usage in mobile source");
    mustNotMatch(source, file, /document\.cookie/iu, "document.cookie usage in mobile source");
    mustNotMatch(
      source,
      file,
      /console\.(log|debug|info|warn|error)\s*\([^)]*(accessToken|refreshToken|passwordHash|authorization|cookie|otp)/iu,
      "sensitive mobile console logging"
    );
  }
}

function checkWebInventory() {
  const web = corpus(webInventoryFiles);
  const docs = corpus([
    "docs/60-public-auth-cookie-migration-plan.md",
    "docs/71-public-safety-abuse-flow-boundary.md",
    "docs/72-auth-session-realtime-readstate-boundary.md",
    "docs/75-p0-release-surface-smoke-inventory.md"
  ]);

  for (const token of [
    "auth-session",
    "x-babyloop-csrf-token",
    "/api/v1/auth/csrf",
    "favorites",
    "browse",
    "listing-detail",
    "messaging",
    "sell-upload"
  ]) {
    mustContain(web + docs, "web P0 smoke inventory", token);
  }

  mustContainOne(web + docs, "web hidden safety action inventory", ["menu/kebab", "hidden behind a menu", "ReportAction", "BlockProfileAction"]);
  mustContainOne(web + docs, "web no token leak inventory", ["does not expose accessToken", "not.toMatch", "not.toContain"]);
}

function checkBackofficeInventory() {
  const backoffice = corpus(backofficeInventoryFiles);
  const docs = corpus([
    "docs/32-backoffice-data-privacy-and-redaction.md",
    "docs/34-permissioned-sensitive-access-and-audit.md",
    "docs/36-listing-admin-review-tools.md",
    "docs/71-public-safety-abuse-flow-boundary.md",
    "docs/75-p0-release-surface-smoke-inventory.md"
  ]);

  for (const token of [
    "credentials",
    "cookie",
    "csrf",
    "admin",
    "redacted",
    "sensitive access",
    "reason",
    "audit",
    "image review",
    "conversation",
    "moderation"
  ]) {
    mustContain(backoffice + docs, "backoffice P0 smoke inventory", token);
  }

  mustContainOne(backoffice + docs, "backoffice RBAC inventory", ["RBAC", "Non-admin", "admin-only", "protected"]);
  mustContainOne(backoffice + docs, "backoffice no raw data inventory", ["raw message body", "email", "phone", "token", "passwordHash"]);
}

function checkApiInventory() {
  const api = corpus(apiInventoryFiles);
  const docs = corpus([
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/75-p0-release-surface-smoke-inventory.md"
  ]);

  for (const token of [
    "auth",
    "listings",
    "messaging",
    "notifications",
    "safety",
    "moderation",
    "image",
    "redaction",
    "resetTestDatabase",
    "TEST_DATABASE_URL",
    "seed"
  ]) {
    mustContain(api + docs, "API P0 security aggregate inventory", token);
  }

  mustContainOne(api + docs, "API provider-disabled inventory", ["does not enable provider calls", "mock", "unavailable", "sendEnabled=false"]);
}

function checkDocsInventory() {
  const docs75 = read("docs/75-p0-release-surface-smoke-inventory.md");

  for (const token of [
    "P0 Release Surface Smoke Inventory and Gate Audit",
    "#155",
    "#156",
    "#157",
    "#158",
    "#159",
    "#160",
    "#161",
    "#162",
    "#163",
    "#164",
    "#165",
    "#166",
    "#167",
    "#168",
    "Codex did not run tests",
    "Real-device S22/Maestro deferred",
    "Release blocker checklist",
    "No-leak checklist",
    "Provider/queue/n8n/email/push disabled checklist",
    "pnpm security:p0-release-surface-smoke-inventory",
    "pnpm release:mobile:p0",
    "TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm test:api:security",
    "pnpm beta:critical-smoke"
  ]) {
    mustContain(docs75, "docs/75-p0-release-surface-smoke-inventory.md", token);
  }
}

function checkNoLeakAndProviderBoundaries() {
  const docsAndTests = corpus([
    ...mobileInventoryFiles,
    ...webInventoryFiles,
    ...backofficeInventoryFiles,
    ...apiInventoryFiles,
    "docs/54-production-env-checklist.md",
    "docs/70-notification-surface-consistency-audit.md",
    "docs/71-public-safety-abuse-flow-boundary.md",
    "docs/75-p0-release-surface-smoke-inventory.md"
  ]);

  for (const token of [
    "does not expose accessToken",
    "does not expose refreshToken",
    "does not expose passwordHash",
    "does not expose cookie",
    "does not expose authorization",
    "does not expose email",
    "does not expose phone",
    "does not expose raw message body"
  ]) {
    mustContain(docsAndTests, "P0 no-leak inventory", token);
  }

  for (const token of [
    "does not enable real email sending",
    "does not enable real push sending",
    "does not enable real n8n workflow triggering",
    "does not enable queues",
    "does not enable provider calls"
  ]) {
    mustContain(docsAndTests, "P0 provider disabled inventory", token);
  }
}

if (problems.length > 0) {
  console.error("P0 release surface smoke inventory boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("P0 release surface smoke inventory boundary passed.");

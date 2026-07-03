#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const bundles = {
  security: [
    "test/auth.integration.test.ts",
    "test/auth-config.test.ts",
    "test/backoffice-access-token-cookie.test.ts",
    "test/backoffice-csrf.test.ts",
    "test/public-access-token-cookie.test.ts",
    "test/refresh-token-cookie.test.ts",
    "test/listings.integration.test.ts",
    "test/messaging.integration.test.ts",
    "test/notifications.integration.test.ts",
    "test/safety.integration.test.ts",
    "test/product-events.routes.test.ts",
  ],
  trust: [
    "test/messaging.integration.test.ts",
    "test/safety.integration.test.ts",
    "test/notifications.integration.test.ts",
    "test/favorites.integration.test.ts",
    "test/saved-searches.routes.test.ts",
  ],
  backoffice: [
    "test/backoffice-route-permissions.integration.test.ts",
    "test/admin-moderation.integration.test.ts",
    "test/admin-ops.routes.test.ts",
    "test/admin-email.routes.test.ts",
    "test/admin-rag.routes.test.ts",
    "test/backoffice-permissions.test.ts",
    "test/backoffice-csrf.test.ts",
  ],
  marketplace: [
    "test/listings.integration.test.ts",
    "test/favorites.integration.test.ts",
    "test/saved-searches.routes.test.ts",
    "test/seller-dashboard.routes.test.ts",
    "test/product-events.routes.test.ts",
    "test/search-suggestions.routes.test.ts",
    "test/cart-checkout.integration.test.ts",
    "test/child-profiles.routes.test.ts",
    "test/child-profile-notes-reminders.routes.test.ts",
  ],
  release: [
    "test/health.integration.test.ts",
    "test/auth.integration.test.ts",
    "test/auth-config.test.ts",
    "test/backoffice-access-token-cookie.test.ts",
    "test/backoffice-csrf.test.ts",
    "test/public-access-token-cookie.test.ts",
    "test/refresh-token-cookie.test.ts",
    "test/listings.integration.test.ts",
    "test/listing-image-authenticity.integration.test.ts",
    "test/favorites.integration.test.ts",
    "test/saved-searches.routes.test.ts",
    "test/seller-dashboard.routes.test.ts",
    "test/search-suggestions.routes.test.ts",
    "test/cart-checkout.integration.test.ts",
    "test/child-profiles.routes.test.ts",
    "test/child-profile-notes-reminders.routes.test.ts",
    "test/messaging.integration.test.ts",
    "test/notifications.integration.test.ts",
    "test/safety.integration.test.ts",
    "test/product-events.routes.test.ts",
    "test/assistant.integration.test.ts",
    "test/rag.routes.test.ts",
    "test/realtime.integration.test.ts",
  ],
};

const bundleName = process.argv[2];

if (!bundleName || bundleName === "--help" || bundleName === "-h") {
  printUsage();
  process.exit(bundleName ? 0 : 1);
}

const specs = bundles[bundleName];

if (!specs) {
  console.error(`Unknown API test bundle: ${bundleName}`);
  printUsage();
  process.exit(1);
}

const missingSpecs = specs.filter((spec) => !existsSync(`apps/api/${spec}`));

if (missingSpecs.length > 0) {
  console.error("API test bundle references missing spec files:");
  for (const spec of missingSpecs) {
    console.error(`- apps/api/${spec}`);
  }
  process.exit(1);
}

const env = {
  ...process.env,
  TEST_DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
};

const args = [
  "--filter",
  "@babyloop/api",
  "exec",
  "vitest",
  "run",
  ...specs,
  "--config",
  "vitest.config.ts",
];

console.log(`Running API test bundle: ${bundleName}`);
console.log(`Specs: ${specs.join(", ")}`);

const result = spawnSync("pnpm", args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);

function printUsage() {
  console.log("Usage: node scripts/run-api-test-bundle.mjs <bundle>");
  console.log("");
  console.log("Available bundles:");
  for (const [name, specs] of Object.entries(bundles)) {
    console.log(`- ${name}: ${specs.length} spec(s)`);
  }
}

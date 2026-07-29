import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seed = await readFile(new URL("../../../packages/database/src/production-demo-seed.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../../../packages/database/drizzle/0045_production_demo_marketplace.sql", import.meta.url), "utf8");
const assetUpload = await readFile(new URL("../../../apps/api/src/scripts/production-demo-assets.ts", import.meta.url), "utf8");
const cartRoute = await readFile(new URL("../../../apps/api/src/routes/cart.routes.ts", import.meta.url), "utf8");
const messagingRoute = await readFile(new URL("../../../apps/api/src/routes/messaging.routes.ts", import.meta.url), "utf8");
const cartService = await readFile(new URL("../../../apps/api/src/services/cart.service.ts", import.meta.url), "utf8");
const messagingService = await readFile(new URL("../../../apps/api/src/services/messaging.service.ts", import.meta.url), "utf8");

test("production seed is confirmation guarded, transactional and demo-key scoped", () => {
  for (const token of [
    "SEED_PRODUCTION_DEMO_DATA", "single_environment", "EXPECTED_DATABASE_NAME", "EXPECTED_GCP_PROJECT_ID",
    "pg_advisory_xact_lock", "begin", "rollback", "where listings.is_demo = true", "nonDemoRowsTouched: 0",
    "externalProviderCallsExecuted: false", "notificationsTriggered: false"
  ]) assert.match(seed, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.doesNotMatch(seed, /delete from listings|truncate\s+listings/i);
});

test("migration enforces explicit demo metadata and partial uniqueness", () => {
  assert.match(migration, /is_demo.*default false.*not null/i);
  assert.match(migration, /where "demo_seed_key" is not null/i);
  assert.match(migration, /listings_demo_seed_metadata_check/i);
  assert.match(migration, /login_disabled/i);
  assert.match(migration, /provider_delivery_disabled/i);
});

test("asset upload is fail-closed and overwrite-disabled", () => {
  for (const token of [
    "UPLOAD_PRODUCTION_DEMO_ASSETS", "DEMO_ASSET_UPLOAD_GIT_SHA", "EXPECTED_R2_BUCKET_NAME",
    "clean worktree", "overwrite is disabled", "method: \"HEAD\"", "content-type"
  ]) assert.ok(assetUpload.includes(token));
});

test("demo commerce and messaging are rejected by backend services with 409 routes", () => {
  assert.match(cartService, /if \(listing\.isDemo\)[\s\S]*demo_listing/);
  assert.match(messagingService, /if \(listing\.isDemo\)[\s\S]*demo_listing/);
  assert.match(cartRoute, /status\(409\)[\s\S]*DEMO_LISTING_COMMERCE_DISABLED/);
  assert.match(messagingRoute, /status\(409\)[\s\S]*DEMO_LISTING_MESSAGING_DISABLED/);
});

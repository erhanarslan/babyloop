import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateReleaseE2ERuntime } from "../../validate-release-e2e-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const localDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test";

const expectedWebReleaseSpecs = [
  "e2e/auth-session.smoke.spec.ts",
  "e2e/protected-routes.smoke.spec.ts",
  "e2e/account-ops.smoke.spec.ts",
  "e2e/home-discovery.smoke.spec.ts",
  "e2e/browse.smoke.spec.ts",
  "e2e/listing-detail.smoke.spec.ts",
  "e2e/cart-checkout.smoke.spec.ts",
  "e2e/favorites.smoke.spec.ts",
  "e2e/my-listings.smoke.spec.ts",
  "e2e/seller-dashboard.smoke.spec.ts",
  "e2e/sell-upload.smoke.spec.ts",
  "e2e/messaging.smoke.spec.ts",
  "e2e/messaging-safety.smoke.spec.ts",
  "e2e/messaging-read-state.smoke.spec.ts"
];
const expectedBackofficeReleaseSpecs = [
  "e2e/login.smoke.spec.ts",
  "e2e/protected-auth-shell.smoke.spec.ts",
  "e2e/moderation-case.smoke.spec.ts",
  "e2e/trust-ops.smoke.spec.ts",
  "e2e/listing-image-review.smoke.spec.ts",
  "e2e/ai-ops.smoke.spec.ts"
];
const webMockModes = new Map([
  ["auth-session.smoke.spec.ts", "real"],
  ["protected-routes.smoke.spec.ts", "mock"],
  ["account-ops.smoke.spec.ts", "mock"],
  ["home-discovery.smoke.spec.ts", "mock"],
  ["browse.smoke.spec.ts", "hybrid"],
  ["listing-detail.smoke.spec.ts", "real"],
  ["cart-checkout.smoke.spec.ts", "real"],
  ["favorites.smoke.spec.ts", "hybrid"],
  ["my-listings.smoke.spec.ts", "real"],
  ["seller-dashboard.smoke.spec.ts", "mock"],
  ["sell-upload.smoke.spec.ts", "hybrid"],
  ["messaging.smoke.spec.ts", "mock"],
  ["messaging-safety.smoke.spec.ts", "mock"],
  ["messaging-read-state.smoke.spec.ts", "mock"]
]);

test("release E2E runtime accepts only a matching local babyloop_test database", () => {
  assert.deepEqual(validateReleaseE2ERuntime({
    DATABASE_URL: localDatabaseUrl,
    TEST_DATABASE_URL: localDatabaseUrl,
    NODE_ENV: "development"
  }), {
    database: "babyloop_test",
    hostClass: "loopback",
    nodeEnv: "development"
  });
  assert.throws(() => validateReleaseE2ERuntime({
    DATABASE_URL: "postgresql://user:pass@db.example.com:5432/babyloop_test",
    TEST_DATABASE_URL: "postgresql://user:pass@db.example.com:5432/babyloop_test",
    NODE_ENV: "development"
  }), /loopback/);
  assert.throws(() => validateReleaseE2ERuntime({
    DATABASE_URL: localDatabaseUrl,
    TEST_DATABASE_URL: localDatabaseUrl.replace("babyloop_test", "babyloop_dev"),
    NODE_ENV: "development"
  }), /must be identical/);
  assert.throws(() => validateReleaseE2ERuntime({
    DATABASE_URL: localDatabaseUrl,
    TEST_DATABASE_URL: localDatabaseUrl,
    NODE_ENV: "production"
  }), /NODE_ENV=development/);
});

test("release E2E shell fixes CI-only auth controls and fails fast without leaking DB credentials", async () => {
  const source = await read("scripts/ci-release-e2e.sh");
  for (const token of [
    'export NODE_ENV="development"',
    'export BABYLOOP_EXPOSE_DEV_AUTH_TOKENS="1"',
    'export AUTH_RATE_LIMIT_MAX="200"',
    'export AUTH_RATE_LIMIT_WINDOW_SECONDS="60"',
    "node scripts/validate-release-e2e-runtime.mjs",
    'node scripts/check-release-e2e-ports.mjs "$API_PORT" "$WEB_PORT" "$BACKOFFICE_PORT"',
    "kill -0 \"$process_id\"",
    "local release E2E: next dev"
  ]) {
    assert.match(source, new RegExp(escapeRegExp(token)));
  }
  assert.doesNotMatch(source, /echo\s+"DATABASE_URL=\$DATABASE_URL"/u);
  assert.match(source, /pnpm --filter @babyloop\/database db:migrate\r?\npnpm demo:seed\r?\n/u);
  assert.doesNotMatch(source, /pnpm demo:seed:keep-e2e/u);
  assert.doesNotMatch(source, /BABYLOOP_SEED_KEEP_E2E_LISTINGS=1/u);
  assert.match(source, /validate-release-e2e-runtime\.mjs[\s\S]*db:migrate/u);
  assert.match(source, /check-release-e2e-ports\.mjs[\s\S]*mkdir -p \.e2e-results[\s\S]*db:migrate/u);
  assert.doesNotMatch(source, /lsof/u);
});

test("Web E2E publication and verification helpers are fail-closed and shell-free", async () => {
  const helper = await read("apps/web/e2e/helpers/web-e2e-api.ts");
  assert.match(helper, /Full-flow Web E2E requires devEmailVerificationToken/u);
  assert.match(helper, /assertEmailVerificationConfirmed\(verificationBody\.data\)/u);
  assert.match(helper, /termsAccepted:\s*true/u);
  assert.match(helper, /termsVersion:\s*CURRENT_TERMS_VERSION/u);
  assert.match(helper, /execFile\(/u);
  assert.match(helper, /e2e-publish-listing\.js/u);
  assert.match(helper, /shell:\s*false/u);
  assert.match(helper, /fetchPublicCsrfToken\(api\)/u);
  assert.match(helper, /status !== "active" \|\| publication\.publicationState !== "published"/u);
  assert.doesNotMatch(helper, /exec\(|spawn\([^\n]*shell:\s*true/u);
});

test("release bundle inventory and real/mock fixture contracts remain explicit", async () => {
  const runner = await read("scripts/run-e2e-test-bundle.mjs");
  const releaseBlocks = [...runner.matchAll(/release:\s*\[([\s\S]*?)\]/gu)].map((match) => (
    [...match[1].matchAll(/"([^"]+\.spec\.ts)"/gu)].map((entry) => entry[1])
  ));
  assert.deepEqual(releaseBlocks[0], expectedWebReleaseSpecs);
  assert.deepEqual(releaseBlocks[1], expectedBackofficeReleaseSpecs);

  for (const [file, mode] of webMockModes) {
    const source = await read(`apps/web/e2e/${file}`);
    if (mode === "mock" || mode === "hybrid") assert.match(source, /page\.route\(/u, `${file} mock contract`);
    if (mode === "real" || mode === "hybrid") {
      assert.match(source, /request\.newContext|createVerifiedUser/u, `${file} real API contract`);
    }
    assert.doesNotMatch(source, /process\.env\.(?:AUTH_SECRET|DATABASE_URL|TEST_DATABASE_URL)/u, `${file} secret isolation`);
  }

  for (const spec of expectedBackofficeReleaseSpecs) {
    const file = spec.replace("e2e/", "");
    const source = await read(`apps/backoffice/e2e/${file}`);
    if (file !== "login.smoke.spec.ts") assert.match(source, /page\.route\(/u, `${file} mock contract`);
    assert.doesNotMatch(source, /process\.env\.(?:AUTH_SECRET|DATABASE_URL|TEST_DATABASE_URL)/u, `${file} secret isolation`);
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

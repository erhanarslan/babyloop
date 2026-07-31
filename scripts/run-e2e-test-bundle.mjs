#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const bundles = {
  web: {
    auth: [
      "e2e/auth-session.smoke.spec.ts",
      "e2e/protected-routes.smoke.spec.ts",
      "e2e/account-ops.smoke.spec.ts",
      "e2e/overlay-scroll.smoke.spec.ts",
    ],
    marketplace: [
      "e2e/home-discovery.smoke.spec.ts",
      "e2e/browse.smoke.spec.ts",
      "e2e/listing-detail.smoke.spec.ts",
      "e2e/cart-checkout.smoke.spec.ts",
      "e2e/favorites.smoke.spec.ts",
      "e2e/my-listings.smoke.spec.ts",
      "e2e/seller-dashboard.smoke.spec.ts",
      "e2e/sell-upload.smoke.spec.ts",
    ],
    messaging: [
      "e2e/messaging.smoke.spec.ts",
      "e2e/messaging-safety.smoke.spec.ts",
      "e2e/messaging-read-state.smoke.spec.ts",
    ],
    release: [
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
      "e2e/messaging-read-state.smoke.spec.ts",
      "e2e/overlay-scroll.smoke.spec.ts",
    ],
  },
  backoffice: {
    trust: [
      "e2e/protected-auth-shell.smoke.spec.ts",
      "e2e/moderation-case.smoke.spec.ts",
      "e2e/trust-ops.smoke.spec.ts",
      "e2e/listing-image-review.smoke.spec.ts",
    ],
    ops: [
      "e2e/login.smoke.spec.ts",
      "e2e/ai-ops.smoke.spec.ts",
    ],
    release: [
      "e2e/login.smoke.spec.ts",
      "e2e/protected-auth-shell.smoke.spec.ts",
      "e2e/moderation-case.smoke.spec.ts",
      "e2e/trust-ops.smoke.spec.ts",
      "e2e/listing-image-review.smoke.spec.ts",
      "e2e/ai-ops.smoke.spec.ts",
    ],
  },
};

const appName = process.argv[2];
const bundleName = process.argv[3];

if (!appName || !bundleName || appName === "--help" || appName === "-h") {
  printUsage();
  process.exit(appName ? 0 : 1);
}

if (!["web", "backoffice"].includes(appName)) {
  console.error(`Unknown E2E app: ${appName}`);
  printUsage();
  process.exit(1);
}

const appBundles = bundles[appName];
const specs = appBundles?.[bundleName];

if (!specs) {
  console.error(`Unknown ${appName} E2E bundle: ${bundleName}`);
  printUsage();
  process.exit(1);
}

const packageName = appName === "web" ? "@babyloop/web" : "@babyloop/backoffice";
const appDir = `apps/${appName}`;
const missingSpecs = specs.filter((spec) => !existsSync(`${appDir}/${spec}`));

if (missingSpecs.length > 0) {
  console.error(`${appName} E2E bundle references missing spec files:`);
  for (const spec of missingSpecs) {
    console.error(`- ${appDir}/${spec}`);
  }
  process.exit(1);
}

const env = {
  ...process.env,
  WEB_E2E_FULL_FLOW: process.env.WEB_E2E_FULL_FLOW ?? "1",
  WEB_E2E_BASE_URL: process.env.WEB_E2E_BASE_URL ?? "http://localhost:3000",
  WEB_E2E_API_BASE_URL: process.env.WEB_E2E_API_BASE_URL ?? "http://127.0.0.1:4000",
  BACKOFFICE_E2E_BASE_URL:
    process.env.BACKOFFICE_E2E_BASE_URL ?? "http://localhost:3001",
  BACKOFFICE_E2E_API_BASE_URL:
    process.env.BACKOFFICE_E2E_API_BASE_URL ?? "http://127.0.0.1:4000",
};

const args = [
  "--filter",
  packageName,
  "exec",
  "playwright",
  "test",
  ...specs,
  "--reporter=list",
  "--workers=1",
];

console.log(`Running ${appName} E2E bundle: ${bundleName}`);
console.log(`Specs: ${specs.join(", ")}`);

const result = spawnSync("pnpm", args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);

function printUsage() {
  console.log("Usage: node scripts/run-e2e-test-bundle.mjs <web|backoffice> <bundle>");
  console.log("");
  console.log("Available bundles:");
  for (const [app, appBundles] of Object.entries(bundles)) {
    for (const [name, specs] of Object.entries(appBundles)) {
      console.log(`- ${app} ${name}: ${specs.length} spec(s)`);
    }
  }
}

import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "scripts/run-beta-critical-smoke.mjs",
  "scripts/check-beta-critical-smoke-boundary.mjs",
  "docs/58-beta-critical-smoke-automation.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/84-legal-kvkk-consent-public-trust.md",
  "scripts/check-legal-public-trust-boundary.mjs",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required beta critical smoke file: ${file}`);
  }
}

function read(relativePath) {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8");
}

function mustContain(source, file, token) {
  if (!source.includes(token)) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function mustContainCaseInsensitive(source, file, token) {
  if (!source.toLowerCase().includes(token.toLowerCase())) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function mustNotContain(source, file, token) {
  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
  }
}

if (problems.length === 0) {
  checkRunner();
  checkPackageScripts();
  checkDocs();
}

function checkRunner() {
  const file = "scripts/run-beta-critical-smoke.mjs";
  const source = read(file);

  for (const token of [
    "Beta critical smoke boundary",
    "security:beta-critical-smoke",
    "test:api:security",
    "security:assistant-safety-guard",
    "security:storage-ops-preview",
    "Mobile P0 release gate boundary",
    "security:mobile-p0-gate",
    "Mobile P0 release gate",
    "release:mobile:p0",
    "qa:mobile:s22",
    "security:mobile-otp-mfa-hardening",
    "security:child-notebook-reminder-hardening",
    "security:notification-preference-qa",
    "security:notification-n8n-readiness",
    "security:notification-push-readiness",
    "security:notification-sender-provider-design",
    "security:notification-observability-taxonomy",
    "security:notification-consent-preference",
    "security:notification-delivery-transitions",
    "security:notification-ops-preview",
    "security:notification-delivery-log",
    "security:notification-provider-execution",
    "security:notification-worker-atomic-claim",
    "security:runtime-readiness-observability",
    "security:backup-restore-rollback",
    "security:staging-deployment",
    "security:legal-public-trust",
    "security:auth-leaks",
    "security:public-auth-cookie-migration",
    "release:artifacts",
    "security:deployment-readiness",
    "@babyloop/api",
    "@babyloop/backoffice",
    "@babyloop/web",
    "@babyloop/mobile",
    "BABYLOOP_BETA_SMOKE_SKIP_TYPECHECK",
    "Manual physical Galaxy S22 QA evidence must still be recorded"
  ]) {
    mustContain(source, file, token);
  }

  for (const forbidden of [
    "N8N_WEBHOOK_URL",
    "WEBHOOK_SECRET",
    "EXPO_ACCESS_TOKEN",
    "FIREBASE_PRIVATE_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "R2_ACCESS_KEY",
    "sk_live_",
    "iyzicoSecret",
    "curl https://hooks.",
    "fetch(",
    "console.log(process.env)",
    "test:e2e:mobile",
    "maestro test",
    "RUN_MOBILE_E2E",
    "expo start"
  ]) {
    mustNotContain(source, file, forbidden);
  }
}

function checkPackageScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const betaSmoke = scripts["beta:critical-smoke"] ?? "";
  const securitySmoke = scripts["security:beta-critical-smoke"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";
  const mobileP0 = scripts["release:mobile:p0"] ?? "";
  const mobileP0Boundary = scripts["security:mobile-p0-gate"] ?? "";

  mustContain(betaSmoke, "package.json#beta:critical-smoke", "node scripts/run-beta-critical-smoke.mjs");
  mustContain(securitySmoke, "package.json#security:beta-critical-smoke", "node scripts/check-beta-critical-smoke-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:beta-critical-smoke");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:legal-public-trust");
  mustContain(mobileP0Boundary, "package.json#security:mobile-p0-gate", "node scripts/check-mobile-p0-release-gate.mjs");
  mustContain(mobileP0, "package.json#release:mobile:p0", "pnpm security:mobile-auth");
  mustContain(mobileP0, "package.json#release:mobile:p0", "pnpm security:mobile-notifications");
  mustContain(mobileP0, "package.json#release:mobile:p0", "pnpm test:mobile:p0");
  mustContain(mobileP0, "package.json#release:mobile:p0", "pnpm --filter @babyloop/mobile typecheck");
  mustNotContain(mobileP0, "package.json#release:mobile:p0", "maestro");
  mustNotContain(mobileP0, "package.json#release:mobile:p0", "test:e2e:mobile");
  mustNotContain(mobileP0, "package.json#release:mobile:p0", "RUN_MOBILE_E2E");
  mustNotContain(mobileP0, "package.json#release:mobile:p0", "expo start");
}

function checkDocs() {
  const docs = [
    "docs/58-beta-critical-smoke-automation.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "full beta critical smoke automation");
    mustContain(source, file, "pnpm beta:critical-smoke");
    mustContain(source, file, "pnpm security:beta-critical-smoke");
    mustContainCaseInsensitive(source, file, "assistant safety guard");
    mustContainCaseInsensitive(source, file, "storage ops preview");
    mustContainCaseInsensitive(source, file, "mobile p0 release gate");
    mustContain(source, file, "pnpm release:mobile:p0");
    mustContainCaseInsensitive(source, file, "mobile real-device s22 qa");
    mustContainCaseInsensitive(source, file, "notification readiness");
    mustContain(source, file, "security:auth-leaks");
    mustContain(source, file, "release:artifacts");
  }

  const mainDoc = read("docs/58-beta-critical-smoke-automation.md");
  for (const token of [
    "does not replace manual physical Galaxy S22 QA evidence",
    "includes pnpm release:mobile:p0 as the deterministic device-free Mobile P0 release gate",
    "does not run Maestro or require ADB",
    "does not enable push sender",
    "does not enable n8n workflow",
    "does not enable S3/R2 external storage",
    "does not enable autonomous RAG answers"
  ]) {
    mustContain(mainDoc, "docs/58-beta-critical-smoke-automation.md", token);
  }
}

if (problems.length > 0) {
  console.error("Beta critical smoke boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Beta critical smoke boundary guard passed.");

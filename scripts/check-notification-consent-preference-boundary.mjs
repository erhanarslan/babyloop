import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/notification-consent-preference-policy.service.ts",
  "apps/api/test/notification-consent-preference-policy.service.test.ts",
  "scripts/check-notification-consent-preference-boundary.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "scripts/check-beta-critical-smoke-boundary.mjs",
  "docs/63-notification-consent-preference-policy.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required notification consent preference file: ${file}`);
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
  checkServiceAndTests();
  checkPackageScripts();
  checkBetaSmokeWiring();
  checkDocs();
  checkNoProviderSecretsOrRuntimeSenders();
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/notification-consent-preference-policy.service.ts";
  const testFile = "apps/api/test/notification-consent-preference-policy.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "evaluateNotificationConsentPreference",
    "getNotificationConsentPreferencePreview",
    "assertNotificationConsentPreferenceReadinessOnly",
    "consentRequiredBeforeDelivery: true",
    "preferenceRequiredBeforeDelivery: true",
    "optOutRequired: true",
    "auditRequired: true",
    "rateLimitRequired: true",
    "blockedUserSafetyRequired: true",
    "rawContactLoggingAllowed: false",
    "deliveryMutationAllowed: false",
    "providerCallAllowed: false",
    "consent_missing",
    "channel_disabled",
    "source_disabled",
    "muted",
    "rate_limited",
    "blocked_by_safety"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const forbidden of [
    "deliveryEnabled: true",
    "providerCallsAllowed: true",
    "rawContactLoggingAllowed: true",
    "providerCallAllowed: true",
    "deliveryMutationAllowed: true",
    "console.log"
  ]) {
    mustNotContain(service, serviceFile, forbidden);
  }

  for (const token of [
    "blocks delivery when consent is missing",
    "blocks disabled channels, disabled sources, mutes, safety blocks, and rate limits",
    "allows only policy-approved candidates while keeping provider calls disabled",
    "exposes readiness preview with required preference scopes",
    "exposes compact readiness-only assertion"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkPackageScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const consentScript = scripts["security:notification-consent-preference"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(
    consentScript,
    "package.json#security:notification-consent-preference",
    "node scripts/check-notification-consent-preference-boundary.mjs"
  );
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:notification-consent-preference");
}

function checkBetaSmokeWiring() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");
  const boundary = read("scripts/check-beta-critical-smoke-boundary.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Notification consent preference guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:notification-consent-preference");
  mustContain(boundary, "scripts/check-beta-critical-smoke-boundary.mjs", "security:notification-consent-preference");
}

function checkDocs() {
  const docs = [
    "docs/63-notification-consent-preference-policy.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "notification consent/preference policy");
    mustContain(source, file, "pnpm security:notification-consent-preference");
    mustContainCaseInsensitive(source, file, "consent");
    mustContainCaseInsensitive(source, file, "preference");
    mustContainCaseInsensitive(source, file, "opt-out");
    mustContainCaseInsensitive(source, file, "audit");
    mustContainCaseInsensitive(source, file, "rate limit");
    mustContainCaseInsensitive(source, file, "blocked user");
    mustContainCaseInsensitive(source, file, "raw contact logging");
  }

  const mainDoc = read("docs/63-notification-consent-preference-policy.md");
  for (const token of [
    "does not enable real email sending",
    "does not enable real push sending",
    "does not enable real n8n workflow triggering",
    "does not enable provider calls",
    "does not enable queue jobs",
    "raw contact logging remains disabled",
    "real notification delivery remains blocked until explicit implementation"
  ]) {
    mustContain(mainDoc, "docs/63-notification-consent-preference-policy.md", token);
  }
}

function checkNoProviderSecretsOrRuntimeSenders() {
  const files = [
    "apps/api/src/services/notification-consent-preference-policy.service.ts",
    "scripts/check-notification-consent-preference-boundary.mjs",
    "docs/63-notification-consent-preference-policy.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  const forbiddenTokens = [
    ["parent@", "example.com"],
    ["access-token", "-secret"],
    ["refresh-token", "-secret"],
    ["otp", "-secret"],
    ["raw-contact", "-secret"],
    ["RESEND", "_API_KEY="],
    ["SENDGRID", "_API_KEY="],
    ["EXPO_ACCESS", "_TOKEN="],
    ["FIREBASE_PRIVATE", "_KEY="],
    ["N8N_WEBHOOK", "_URL="],
    ["WEBHOOK", "_SECRET="],
    ["sendEmail", "("],
    ["sendPush", "("],
    ["triggerN8n", "("],
    ["queue", ".add"],
    ["fetch", "("],
    ["console.log", "(process.env)"]
  ].map((parts) => parts.join(""));

  for (const file of files) {
    const source = read(file);
    for (const forbidden of forbiddenTokens) {
      mustNotContain(source, file, forbidden);
    }
  }
}

if (problems.length > 0) {
  console.error("Notification consent preference boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification consent preference boundary guard passed.");

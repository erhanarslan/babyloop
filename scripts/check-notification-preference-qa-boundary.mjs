import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/notification-preference-qa-readiness.service.ts",
  "apps/api/test/notification-preference-qa-readiness.service.test.ts",
  "scripts/check-notification-preference-qa-boundary.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "scripts/check-beta-critical-smoke-boundary.mjs",
  "docs/66-notification-preference-qa-gate.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-real-device-s22-qa-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required notification preference QA file: ${file}`);
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
  checkNoRuntimeDeliveryOrSecrets();
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/notification-preference-qa-readiness.service.ts";
  const testFile = "apps/api/test/notification-preference-qa-readiness.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "evaluateNotificationPreferenceQaScenario",
    "getNotificationPreferenceQaReadiness",
    "assertNotificationPreferenceQaReadinessOnly",
    "backofficeQaRequired: true",
    "mobileQaRequired: true",
    "webQaRequired: true",
    "manualQaEvidenceRequired: true",
    "providerCallsAllowed: false",
    "deliveryEnabled: false",
    "rawContactLoggingAllowed: false",
    "preference_not_visible",
    "toggle_not_visible",
    "opt_out_not_visible",
    "audit_not_visible",
    "disabled_state_not_explained",
    "consent_required_not_explained",
    "rate_limit_not_explained",
    "blocked_user_safety_not_explained",
    "backoffice notification preferences visible",
    "mobile notification preferences visible",
    "web notification preferences visible",
    "manual QA evidence attached"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const forbidden of [
    "providerCallsAllowed: true",
    "deliveryEnabled: true",
    "rawContactLoggingAllowed: true",
    "providerCallAllowed: true",
    "deliveryMutationAllowed: true",
    "console.log"
  ]) {
    mustNotContain(service, serviceFile, forbidden);
  }

  for (const token of [
    "accepts a fully visible backoffice preference scenario while keeping delivery disabled",
    "detects missing mobile preference QA coverage",
    "defines required surfaces, channels, sources, and manual QA evidence",
    "keeps real delivery and raw contact logging blocked",
    "exposes compact readiness-only assertion"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkPackageScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const qaScript = scripts["security:notification-preference-qa"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(
    qaScript,
    "package.json#security:notification-preference-qa",
    "node scripts/check-notification-preference-qa-boundary.mjs"
  );
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:notification-preference-qa");
}

function checkBetaSmokeWiring() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");
  const boundary = read("scripts/check-beta-critical-smoke-boundary.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Notification preference QA guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:notification-preference-qa");
  mustContain(boundary, "scripts/check-beta-critical-smoke-boundary.mjs", "security:notification-preference-qa");
}

function checkDocs() {
  const docs = [
    "docs/66-notification-preference-qa-gate.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/56-mobile-real-device-s22-qa-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "notification preference QA");
    mustContain(source, file, "pnpm security:notification-preference-qa");
    mustContainCaseInsensitive(source, file, "backoffice notification preferences");
    mustContainCaseInsensitive(source, file, "mobile notification preferences");
    mustContainCaseInsensitive(source, file, "manual QA evidence");
    mustContainCaseInsensitive(source, file, "opt-out");
    mustContainCaseInsensitive(source, file, "audit");
    mustContainCaseInsensitive(source, file, "rate limit");
    mustContainCaseInsensitive(source, file, "blocked user safety");
    mustContainCaseInsensitive(source, file, "raw contact logging");
  }

  const mainDoc = read("docs/66-notification-preference-qa-gate.md");
  for (const token of [
    "does not enable real sending",
    "does not enable provider calls",
    "does not enable queue jobs",
    "does not enable webhook calls",
    "raw contact logging remains disabled",
    "manual QA evidence is required before beta release",
    "notification preference QA remains blocked until explicit implementation"
  ]) {
    mustContain(mainDoc, "docs/66-notification-preference-qa-gate.md", token);
  }
}

function checkNoRuntimeDeliveryOrSecrets() {
  const files = [
    "apps/api/src/services/notification-preference-qa-readiness.service.ts",
    "scripts/check-notification-preference-qa-boundary.mjs",
    "docs/66-notification-preference-qa-gate.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  const forbiddenTokens = [
    ["parent@", "example.com"],
    ["access-token", "-secret"],
    ["refresh-token", "-secret"],
    ["raw-contact", "-secret"],
    ["sendEmail", "("],
    ["sendPush", "("],
    ["triggerN8n", "("],
    ["queue", ".add"],
    ["fetch", "("],
    ["WEBHOOK", "_SECRET="],
    ["N8N_WEBHOOK", "_URL="],
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
  console.error("Notification preference QA boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification preference QA boundary guard passed.");

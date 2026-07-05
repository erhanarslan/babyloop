import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/notification-observability-taxonomy.service.ts",
  "apps/api/test/notification-observability-taxonomy.service.test.ts",
  "scripts/check-notification-observability-taxonomy-boundary.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "scripts/check-beta-critical-smoke-boundary.mjs",
  "docs/62-notification-observability-taxonomy.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required notification observability taxonomy file: ${file}`);
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
  checkNoRuntimeExportersOrSecrets();
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/notification-observability-taxonomy.service.ts";
  const testFile = "apps/api/test/notification-observability-taxonomy.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "getNotificationObservabilityTaxonomy",
    "assertNotificationObservabilityReadinessOnly",
    "notification.candidate.created",
    "notification.delivery.blocked",
    "notification.delivery.skipped",
    "notification.delivery.sent",
    "notification.delivery.failed",
    "notification.preference.updated",
    "notification.readiness.previewed",
    "notification.provider.sandbox_required",
    "notification.dead_letter.recorded",
    "notification.retry.scheduled",
    "notification.click.recorded",
    "deliveryEnabled: false",
    "providerCallsAllowed: false",
    "rawPayloadLoggingAllowed: false",
    "piiLoggingAllowed: false",
    "metricsEnabled: false",
    "tracingEnabled: false",
    "allowEmail: false",
    "allowPhone: false",
    "allowRawMessageBody: false",
    "allowRawProviderResponse: false",
    "allowRawWebhookPayload: false"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const forbidden of [
    "metricsEnabled: true",
    "tracingEnabled: true",
    "providerCallsAllowed: true",
    "rawPayloadLoggingAllowed: true",
    "piiLoggingAllowed: true",
    "console.log"
  ]) {
    mustNotContain(service, serviceFile, forbidden);
  }

  for (const token of [
    "defines privacy-safe notification events without enabling delivery",
    "lists required metrics and dashboards without enabling exporters",
    "keeps raw payload, provider, and PII logging disabled",
    "exposes a compact readiness-only assertion"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkPackageScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const taxonomyScript = scripts["security:notification-observability-taxonomy"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(
    taxonomyScript,
    "package.json#security:notification-observability-taxonomy",
    "node scripts/check-notification-observability-taxonomy-boundary.mjs"
  );
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:notification-observability-taxonomy");
}

function checkBetaSmokeWiring() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");
  const boundary = read("scripts/check-beta-critical-smoke-boundary.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Notification observability taxonomy guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:notification-observability-taxonomy");
  mustContain(boundary, "scripts/check-beta-critical-smoke-boundary.mjs", "security:notification-observability-taxonomy");
}

function checkDocs() {
  const docs = [
    "docs/62-notification-observability-taxonomy.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "notification observability taxonomy");
    mustContain(source, file, "pnpm security:notification-observability-taxonomy");
    mustContainCaseInsensitive(source, file, "event taxonomy");
    mustContainCaseInsensitive(source, file, "privacy-safe");
    mustContainCaseInsensitive(source, file, "metrics");
    mustContainCaseInsensitive(source, file, "dashboard");
    mustContainCaseInsensitive(source, file, "raw payload logging");
    mustContainCaseInsensitive(source, file, "PII");
  }

  const mainDoc = read("docs/62-notification-observability-taxonomy.md");
  for (const token of [
    "does not enable metrics exporters",
    "does not enable tracing exporters",
    "does not enable provider calls",
    "does not enable queue jobs",
    "does not enable webhook calls",
    "does not enable real email sending",
    "does not enable real push sending",
    "does not enable real n8n workflow triggering",
    "raw payload logging remains disabled"
  ]) {
    mustContain(mainDoc, "docs/62-notification-observability-taxonomy.md", token);
  }
}

function checkNoRuntimeExportersOrSecrets() {
  const files = [
    "apps/api/src/services/notification-observability-taxonomy.service.ts",
    "scripts/check-notification-observability-taxonomy-boundary.mjs",
    "docs/62-notification-observability-taxonomy.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  const forbiddenTokens = [
    ["parent@", "example.com"],
    ["access-token", "-secret"],
    ["refresh-token", "-secret"],
    ["otp", "-secret"],
    ["raw-message-body", "-secret"],
    ["raw-provider-response", "-secret"],
    ["raw-webhook-payload", "-secret"],
    ["PrometheusExporter", "("],
    ["OpenTelemetry", "("],
    ["trace", ".setAttribute"],
    ["metrics", ".counter"],
    ["queue", ".add"],
    ["fetch", "("],
    ["curl https://", "hooks."],
    ["sendEmail", "("],
    ["sendPush", "("],
    ["triggerN8n", "("],
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
  console.error("Notification observability taxonomy boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification observability taxonomy boundary guard passed.");

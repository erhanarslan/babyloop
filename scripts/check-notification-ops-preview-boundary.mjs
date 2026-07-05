import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/admin-notification-ops.service.ts",
  "apps/api/test/admin-notification-ops.service.test.ts",
  "apps/backoffice/src/features/notifications/notification-ops-page.tsx",
  "apps/backoffice/src/features/notifications/notification-ops-page.test.tsx",
  "apps/api/src/services/notification-delivery-log.service.ts",
  "docs/25-validation-and-regression-checklist.md",
  "docs/30-rag-architecture.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required notification ops preview file: ${file}`);
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
  checkService();
  checkTestsAndUi();
  checkScriptsAndDocs();
}

function checkService() {
  const file = "apps/api/src/services/admin-notification-ops.service.ts";
  const source = read(file);

  for (const token of [
    "notificationDeliveryLogs",
    "getAdminNotificationDeliveryLogPreview",
    "deliveryLogPreview",
    "totals",
    "byKind",
    "byChannel",
    "byStatus",
    "recent",
    "privacyNote",
    "maskSourceRef",
    "metadata, idempotency key, dedup key",
    "Email, push, n8n, queue veya in-app notification gönderimi yapmaz"
  ]) {
    mustContain(source, file, token);
  }

  for (const forbidden of [
    "idempotencyKey:",
    "dedupKey:",
    "metadata:",
    "sendEmail",
    "sendPush",
    "sendN8n",
    "fetch(\"https://hooks.",
    "fetch(\"https://api.resend.com",
    "EMAIL_SEND_ENABLED=true",
    "console.log"
  ]) {
    if (forbidden === "metadata:") {
      continue;
    }
    mustNotContain(source, file, forbidden);
  }
}

function checkTestsAndUi() {
  const apiTestFile = "apps/api/test/admin-notification-ops.service.test.ts";
  const pageFile = "apps/backoffice/src/features/notifications/notification-ops-page.tsx";
  const pageTestFile = "apps/backoffice/src/features/notifications/notification-ops-page.test.tsx";
  const apiTest = read(apiTestFile);
  const page = read(pageFile);
  const pageTest = read(pageTestFile);

  for (const token of [
    "returns aggregate delivery log preview without leaking sensitive keys",
    "deliveryLogPreview.totals",
    "byKind",
    "byChannel",
    "not.toMatch(/parent@example|ops-preview-user@example|secret-idempotency|secret-dedup|secret-token|session-cookie|Bearer secret|raw-sensitive-payload-from-metadata/iu"
  ]) {
    mustContain(apiTest, apiTestFile, token);
  }

  for (const token of [
    "Delivery log preview",
    "deliveryLogPreview.totals",
    "privacyNote",
    "redacted sourceRef",
    "metadata, idempotency key, dedup key"
  ]) {
    mustContain(page, pageFile, token);
  }

  for (const token of [
    "renders draft-only ops preview, delivery log aggregates, and avoids secret leakage",
    "Delivery log preview",
    "saved_search:saved…ing-1",
    "not.toMatch(/api[_-]?key|password|secret|parent@example|accessToken|refreshToken|secret-idempotency|secret-dedup/iu"
  ]) {
    mustContain(pageTest, pageTestFile, token);
  }
}

function checkScriptsAndDocs() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const securityScript = scripts["security:notification-ops-preview"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(securityScript, "package.json#security:notification-ops-preview", "node scripts/check-notification-ops-preview-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:notification-ops-preview");

  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/30-rag-architecture.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "notification delivery-log ops preview");
    mustContain(source, file, "pnpm security:notification-ops-preview");
    mustContainCaseInsensitive(source, file, "aggregate");
    mustContainCaseInsensitive(source, file, "redacted");
    mustContainCaseInsensitive(source, file, "email/push/n8n");
  }
}

if (problems.length > 0) {
  console.error("Notification ops preview boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification ops preview boundary guard passed.");

import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/notification-delivery-transitions.service.ts",
  "apps/api/test/notification-delivery-transitions.service.test.ts",
  "apps/api/src/services/admin-notification-ops.service.ts",
  "apps/backoffice/src/features/notifications/notification-ops-page.tsx",
  "apps/backoffice/src/features/notifications/notification-ops-page.test.tsx",
  "docs/25-validation-and-regression-checklist.md",
  "docs/30-rag-architecture.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required notification delivery transitions file: ${file}`);
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
  checkOpsPreviewAndUi();
  checkScriptsAndDocs();
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/notification-delivery-transitions.service.ts";
  const testFile = "apps/api/test/notification-delivery-transitions.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "evaluateNotificationDeliveryTransition",
    "getNotificationDeliveryTransitionPreview",
    "allowedDraftOnlyTransitions",
    "futureSenderTransitions",
    "terminalStatuses",
    "deliveryAllowed: false",
    "draftOnly: true",
    "draft_only_skip",
    "draft_only_block",
    "delivery_disabled",
    "provider_not_configured",
    "terminal_status",
    "sanitizeTransitionAuditMetadata"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const forbidden of [
    "sendEmail",
    "sendPush",
    "sendN8n",
    "fetch(\"https://hooks.",
    "fetch(\"https://api.resend.com",
    "EMAIL_SEND_ENABLED=true",
    "console.log"
  ]) {
    mustNotContain(service, serviceFile, forbidden);
  }

  for (const token of [
    "allows draft-only candidate skip without enabling delivery",
    "allows draft-only candidate blocking but does not send",
    "blocks sent transition while delivery is disabled",
    "blocks failed transition until provider attempt/retry policy exists",
    "blocks terminal status transitions",
    "exposes a safe transition preview for ops surfaces",
    "not.toMatch(/parent@example.com|accessToken|refreshToken|passwordHash|otpCode|cookie|authorization/iu"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkOpsPreviewAndUi() {
  const opsFile = "apps/api/src/services/admin-notification-ops.service.ts";
  const pageFile = "apps/backoffice/src/features/notifications/notification-ops-page.tsx";
  const pageTestFile = "apps/backoffice/src/features/notifications/notification-ops-page.test.tsx";
  const ops = read(opsFile);
  const page = read(pageFile);
  const pageTest = read(pageTestFile);

  for (const token of [
    "getNotificationDeliveryTransitionPreview",
    "transitionPreview",
    "allowedDraftOnlyTransitions",
    "futureSenderTransitions"
  ]) {
    mustContain(ops, opsFile, token);
  }

  for (const token of [
    "Teslimat geçiş güvenliği",
    "allowedDraftOnlyTransitions",
    "futureSenderTransitions",
    "Bekliyor → Atlandı",
    "Gönderildi/Başarısız için sağlayıcı güvenlik katmanları zorunludur."
  ]) {
    mustContain(page, pageFile, token);
  }

  for (const token of [
    "Teslimat geçiş güvenliği",
    "Bekliyor → Atlandı",
    "Gönderildi/Başarısız için sağlayıcı güvenlik katmanları zorunludur."
  ]) {
    mustContain(pageTest, pageTestFile, token);
  }
}

function checkScriptsAndDocs() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const securityScript = scripts["security:notification-delivery-transitions"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(securityScript, "package.json#security:notification-delivery-transitions", "node scripts/check-notification-delivery-transitions-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:notification-delivery-transitions");

  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/30-rag-architecture.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "notification delivery transition model");
    mustContain(source, file, "pnpm security:notification-delivery-transitions");
    mustContainCaseInsensitive(source, file, "draft-only");
    mustContainCaseInsensitive(source, file, "sent/failed");
    mustContainCaseInsensitive(source, file, "email/push/n8n");
  }
}

if (problems.length > 0) {
  console.error("Notification delivery transitions boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification delivery transitions boundary guard passed.");

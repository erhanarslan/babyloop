import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/notification-push-readiness.service.ts",
  "apps/api/test/notification-push-readiness.service.test.ts",
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
    problems.push(`Missing required notification push readiness file: ${file}`);
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
  const serviceFile = "apps/api/src/services/notification-push-readiness.service.ts";
  const testFile = "apps/api/test/notification-push-readiness.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "getNotificationPushReadinessPreview",
    "assertNotificationPushSenderDisabled",
    "pushSenderEnabled: false",
    "providerConfigured: false",
    "tokenRegistryEnabled: true",
    "tokenCollectionAllowed: false",
    "deliveryAllowed: false",
    "draftOnly: true",
    "native_device_token_registry",
    "platform_token_validation",
    "device_consent_model",
    "provider_sandbox",
    "retry_dead_letter_policy",
    "rateLimitRequired: true",
    "Expo, Firebase, APNs"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const forbidden of [
    "sendPush",
    "getExpoPushTokenAsync",
    "expo-notifications",
    "firebase-admin",
    "apn.Provider",
    "fetch(",
    "fetch(\"https://hooks.",
    "fetch(\"https://exp.host",
    "PUSH_SEND_ENABLED=true",
    "console.log"
  ]) {
    mustNotContain(service, serviceFile, forbidden);
  }

  for (const token of [
    "keeps native push blocked and draft-only",
    "lists all requirements before enabling push sender",
    "exposes a compact sender-disabled assertion for release gates",
    "not.toMatch(/sendPush|getExpoPushTokenAsync|expo-notifications|firebase-admin|apn\\.Provider|fetch\\(|https:\\/\\/exp\\.host|n8n hook|webhook called/iu"
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
    "getNotificationPushReadinessPreview",
    "pushReadinessPreview",
    "Native push readiness",
    "pushSenderEnabled"
  ]) {
    mustContain(ops, opsFile, token);
  }

  for (const token of [
    "Native push readiness",
    "pushReadinessPreview",
    "pushSenderEnabled",
    "Token registry",
    "Push sender kapalı",
    "Expo/Firebase/APNs çağrısı yok"
  ]) {
    mustContain(page, pageFile, token);
  }

  for (const token of [
    "Native push readiness",
    "Push sender kapalı",
    "Expo/Firebase/APNs çağrısı yok"
  ]) {
    mustContain(pageTest, pageTestFile, token);
  }
}

function checkScriptsAndDocs() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const securityScript = scripts["security:notification-push-readiness"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(securityScript, "package.json#security:notification-push-readiness", "node scripts/check-notification-push-readiness-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:notification-push-readiness");

  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/30-rag-architecture.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "native push readiness");
    mustContain(source, file, "pnpm security:notification-push-readiness");
    mustContainCaseInsensitive(source, file, "push sender");
    mustContainCaseInsensitive(source, file, "token registry");
    mustContainCaseInsensitive(source, file, "expo/firebase/apns");
  }
}

if (problems.length > 0) {
  console.error("Notification push readiness boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification push readiness boundary guard passed.");

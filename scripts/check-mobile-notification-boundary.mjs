import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/mobile/src/features/notifications/notifications-api.ts",
  "apps/mobile/src/features/notifications/notifications-api.test.ts",
  "apps/mobile/src/features/notifications/notifications-model.ts",
  "apps/mobile/src/features/notifications/notifications-model.test.ts",
  "apps/mobile/src/features/notifications/notifications-screen.tsx",
  "apps/mobile/src/features/child/child-reminders-api.ts",
  "apps/mobile/src/features/child/child-reminders-api.test.ts",
  "apps/mobile/src/features/child/child-reminders-model.ts",
  "apps/mobile/src/features/child/child-reminders-model.test.ts",
  "apps/api/src/services/notification-delivery-policy.service.ts",
  "apps/api/test/notification-delivery-policy.service.test.ts",
  "apps/api/src/services/notification-delivery-drafts.service.ts",
  "apps/api/src/services/saved-search-notifications.service.ts",
  "docs/25-validation-and-regression-checklist.md",
  "docs/30-rag-architecture.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-scope-freeze.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required mobile notification boundary file: ${file}`);
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

function mustNotMatch(source, file, pattern, label) {
  if (pattern.test(source)) {
    problems.push(`${file} must not match ${label}.`);
  }
}

if (problems.length === 0) {
  checkMobileNotificationApi();
  checkMobileNotificationModelAndScreen();
  checkMobileChildNotificationPreferences();
  checkApiDeliveryPolicyBoundary();
  checkPackageGate();
  checkDocs();
}

function checkMobileNotificationApi() {
  const file = "apps/mobile/src/features/notifications/notifications-api.ts";
  const testFile = "apps/mobile/src/features/notifications/notifications-api.test.ts";
  const source = read(file);
  const tests = read(testFile);

  for (const token of [
    "mobileAuthFetch",
    "/api/v1/notifications",
    "/api/v1/notifications/unread-count",
    "/api/v1/notifications/${encodeURIComponent(notificationId)}/read",
    "/api/v1/notifications/read-all",
    "/api/v1/notifications/child-lifecycle/generate",
    "deliveryChannel: \"in_app\"",
    "draftOnly: false"
  ]) {
    mustContain(source, file, token);
  }

  for (const token of [
    "fetches notifications through authenticated mobile fetch",
    "fetches unread count",
    "marks one notification read without leaking tokens",
    "marks all notifications read",
    "generates child lifecycle in-app notifications without claiming push delivery",
    "deliveryChannel: \"in_app\"",
    "draftOnly: false",
    "push gönderildi|email gönderildi|n8n çalıştı",
    "mobileAuthFetchMock"
  ]) {
    mustContain(tests, testFile, token);
  }

  for (const forbidden of [
    "expo-notifications",
    "getExpoPushTokenAsync",
    "sendPush",
    "sendEmail",
    "n8n",
    "EMAIL_SEND_ENABLED",
    "@react-native-async-storage/async-storage",
    "localStorage",
    "sessionStorage"
  ]) {
    mustNotContain(source, file, forbidden);
  }
}

function checkMobileNotificationModelAndScreen() {
  const modelFile = "apps/mobile/src/features/notifications/notifications-model.ts";
  const testFile = "apps/mobile/src/features/notifications/notifications-model.test.ts";
  const screenFile = "apps/mobile/src/features/notifications/notifications-screen.tsx";

  const model = read(modelFile);
  const tests = read(testFile);
  const screen = read(screenFile);

  for (const token of [
    "getMobileNotificationCards",
    "getMobileUnreadNotificationCountLabel",
    "getNotificationActionLabel",
    "entityType === \"conversation\"",
    "entityType === \"listing\"",
    "entityType === \"child_profile\"",
    "metadata.source",
    "child_lifecycle"
  ]) {
    mustContain(model, modelFile, token);
  }

  for (const token of [
    "maps API notifications to safe display cards",
    "not.toMatch(/accessToken|refreshToken|passwordHash|email@/iu",
    "formats unread count labels",
    "child_lifecycle"
  ]) {
    mustContain(tests, testFile, token);
  }

  for (const token of [
    "fetchMobileNotifications",
    "fetchMobileUnreadNotificationCount",
    "markMobileNotificationRead",
    "markAllMobileNotificationsRead",
    "router.push(`/conversation/${encodeURIComponent(notification.entityId)}`)",
    "router.push(`/listing/${encodeURIComponent(notification.entityId)}`)",
    "router.push(\"/child-profile\")"
  ]) {
    mustContain(screen, screenFile, token);
  }

  for (const forbidden of [
    "@react-native-async-storage/async-storage",
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "console.log",
    "refreshToken",
    "passwordHash"
  ]) {
    mustNotContain(model, modelFile, forbidden);
    mustNotContain(screen, screenFile, forbidden);
  }
}

function checkMobileChildNotificationPreferences() {
  const apiFile = "apps/mobile/src/features/child/child-reminders-api.ts";
  const apiTestFile = "apps/mobile/src/features/child/child-reminders-api.test.ts";
  const modelFile = "apps/mobile/src/features/child/child-reminders-model.ts";
  const modelTestFile = "apps/mobile/src/features/child/child-reminders-model.test.ts";

  const api = read(apiFile);
  const apiTests = read(apiTestFile);
  const model = read(modelFile);
  const modelTests = read(modelTestFile);

  for (const token of [
    "notificationCadence",
    "\"off\" | \"monthly\" | \"yearly\"",
    "channel: \"in_app\" | \"email_draft\"",
    "mobileAuthFetch"
  ]) {
    mustContain(api, apiFile, token);
  }

  for (const token of [
    "updates notification cadence on the child profile",
    "notificationCadence: \"off\"",
    "not.toMatch(/accessToken|refreshToken|passwordHash/iu"
  ]) {
    mustContain(apiTests, apiTestFile, token);
  }

  for (const token of [
    "getMobileChildReminderSettings",
    "notificationCadence",
    "Email / push gönderimi",
    "status: \"draft\"",
    "formatCadence"
  ]) {
    mustContain(model, modelFile, token);
  }

  for (const token of [
    "maps reminders without claiming real push delivery",
    "not.toMatch(/push|delivery|servis/i",
    "exposes notification settings from child cadence",
    "notificationCadence: \"monthly\""
  ]) {
    mustContain(modelTests, modelTestFile, token);
  }
}

function checkApiDeliveryPolicyBoundary() {
  const policyFile = "apps/api/src/services/notification-delivery-policy.service.ts";
  const policyTestFile = "apps/api/test/notification-delivery-policy.service.test.ts";
  const draftsFile = "apps/api/src/services/notification-delivery-drafts.service.ts";
  const savedSearchFile = "apps/api/src/services/saved-search-notifications.service.ts";

  const policy = read(policyFile);
  const policyTests = read(policyTestFile);
  const drafts = read(draftsFile);
  const savedSearch = read(savedSearchFile);

  for (const token of [
    "deliveryAllowed: false",
    "draftOnly: true",
    "delivery_disabled",
    "delivery_log_required",
    "deliveryLogRequired: true",
    "notification_delivery_logs schema",
    "idempotency key for n8n/email hooks",
    "frequencyWindowHours"
  ]) {
    mustContain(policy, policyFile, token);
  }

  for (const token of [
    "keeps delivery disabled and returns a stable dedup key",
    "expect(result.deliveryAllowed).toBe(false)",
    "expect(result.draftOnly).toBe(true)",
    "delivery_disabled",
    "requirements.deliveryLogRequired",
    "uses longer frequency windows for child lifecycle cadence",
    "notification_delivery_logs schema",
    "idempotency key for n8n/email hooks"
  ]) {
    mustContain(policyTests, policyTestFile, token);
  }

  for (const token of [
    "NotificationDeliveryDraftKind = \"child_lifecycle\" | \"saved_search\"",
    "channel: \"in_app\" | \"email_draft\"",
    "status: \"draft_only\"",
    "draftOnly: true",
    "email, push, n8n veya in-app bildirim göndermez",
    "evaluateNotificationDeliveryPolicy"
  ]) {
    mustContain(drafts, draftsFile, token);
  }

  for (const token of [
    "deliveryChannel: \"in_app\"",
    "draftOnly: false",
    "Email, push veya n8n gönderimi yapmaz"
  ]) {
    mustContain(savedSearch, savedSearchFile, token);
  }

  for (const [file, source] of [
    [policyFile, policy],
    [draftsFile, drafts],
    [savedSearchFile, savedSearch]
  ]) {
    for (const forbidden of [
      "fetch(\"https://hooks.",
      "fetch(\"https://api.resend.com",
      "getExpoPushTokenAsync",
      "sendPush",
      "sendN8n",
      "EMAIL_SEND_ENABLED=true"
    ]) {
      mustNotContain(source, file, forbidden);
    }

    mustNotMatch(source, file, /console\.(log|debug|info)\s*\(/u, "unsafe notification delivery logging");
  }
}

function checkPackageGate() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const securityScript = scripts["security:mobile-notifications"] ?? "";
  const releaseGate = scripts["release:mobile:p0"] ?? "";

  mustContain(securityScript, "package.json#security:mobile-notifications", "node scripts/check-mobile-notification-boundary.mjs");
  mustContain(releaseGate, "package.json#release:mobile:p0", "pnpm security:mobile-auth");
  mustContain(releaseGate, "package.json#release:mobile:p0", "pnpm security:mobile-notifications");
  mustContain(releaseGate, "package.json#release:mobile:p0", "pnpm test:mobile:p0");
  mustContain(releaseGate, "package.json#release:mobile:p0", "pnpm --filter @babyloop/mobile typecheck");
}

function checkDocs() {
  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/30-rag-architecture.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/56-mobile-scope-freeze.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "Mobile notification boundary");
    mustContain(source, file, "pnpm security:mobile-notifications");
    mustContainCaseInsensitive(source, file, "draft-only");
    mustContainCaseInsensitive(source, file, "email/push/n8n");
  }

  const prodChecklist = read("docs/54-production-env-checklist.md");
  for (const token of [
    "Real delivery must not be enabled before delivery logs, deduplication, frequency limiting, idempotency, and admin audit are implemented.",
    "Notification real delivery is enabled without delivery logs, deduplication, frequency limits, idempotency, and admin audit."
  ]) {
    mustContain(prodChecklist, "docs/54-production-env-checklist.md", token);
  }
}

if (problems.length > 0) {
  console.error("Mobile notification boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Mobile notification boundary guard passed.");

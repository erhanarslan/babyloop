#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/routes/notifications.routes.ts",
  "apps/api/src/routes/admin-notifications.routes.ts",
  "apps/api/src/services/notifications.service.ts",
  "apps/api/src/services/notification-delivery-drafts.service.ts",
  "apps/api/src/services/notification-delivery-policy.service.ts",
  "apps/api/src/services/notification-delivery-log.service.ts",
  "apps/api/src/services/notification-delivery-transitions.service.ts",
  "apps/api/src/services/notification-consent-preference-policy.service.ts",
  "apps/api/src/services/notification-push-readiness.service.ts",
  "apps/api/src/services/notification-n8n-readiness.service.ts",
  "apps/api/src/services/notification-observability-taxonomy.service.ts",
  "apps/api/src/services/notification-preference-qa-readiness.service.ts",
  "apps/api/src/services/admin-notification-ops.service.ts",
  "apps/api/src/services/child-lifecycle-notifications.service.ts",
  "apps/api/src/services/saved-search-notifications.service.ts",
  "apps/api/test/notifications.integration.test.ts",
  "apps/api/test/notification-delivery-policy.service.test.ts",
  "apps/api/test/notification-delivery-log.service.test.ts",
  "apps/api/test/notification-delivery-transitions.service.test.ts",
  "apps/api/test/notification-consent-preference-policy.service.test.ts",
  "apps/api/test/notification-push-readiness.service.test.ts",
  "apps/api/test/notification-n8n-readiness.service.test.ts",
  "apps/api/test/notification-observability-taxonomy.service.test.ts",
  "apps/api/test/notification-preference-qa-readiness.service.test.ts",
  "apps/backoffice/src/features/notifications/notification-ops-page.tsx",
  "apps/backoffice/src/features/notifications/notification-ops-page.test.tsx",
  "apps/mobile/src/features/notifications/notifications-api.ts",
  "apps/mobile/src/features/notifications/notifications-api.test.ts",
  "apps/mobile/src/features/notifications/notifications-model.ts",
  "apps/mobile/src/features/notifications/notifications-model.test.ts",
  "apps/mobile/src/features/notifications/notification-preferences-model.ts",
  "apps/mobile/src/features/notifications/notification-preferences-model.test.ts",
  "apps/mobile/src/features/child/child-reminders-api.ts",
  "apps/mobile/src/features/child/child-reminders-api.test.ts",
  "apps/mobile/src/features/child/child-reminders-model.ts",
  "apps/mobile/src/features/child/child-reminders-model.test.ts",
  "apps/web/src/features/notifications/api.ts",
  "apps/web/src/features/notifications/notifications-page-content.tsx",
  "apps/web/src/features/notification-preferences/api.ts",
  "apps/web/src/features/notification-preferences/notification-preferences-page-content.tsx",
  "scripts/check-mobile-notification-boundary.mjs",
  "scripts/check-notification-consent-preference-boundary.mjs",
  "scripts/check-notification-delivery-log-boundary.mjs",
  "scripts/check-notification-delivery-transitions-boundary.mjs",
  "scripts/check-notification-n8n-readiness-boundary.mjs",
  "scripts/check-notification-observability-taxonomy-boundary.mjs",
  "scripts/check-notification-ops-preview-boundary.mjs",
  "scripts/check-notification-preference-qa-boundary.mjs",
  "scripts/check-notification-push-readiness-boundary.mjs",
  "scripts/check-notification-sender-provider-design-boundary.mjs",
  "docs/25-validation-and-regression-checklist.md",
  "docs/30-rag-architecture.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-scope-freeze.md",
  "docs/61-notification-sender-provider-design-gate.md",
  "docs/62-notification-observability-taxonomy.md",
  "docs/63-notification-consent-preference-policy.md",
  "docs/66-notification-preference-qa-gate.md",
  "docs/70-notification-surface-consistency-audit.md",
  "package.json",
  "scripts/run-beta-critical-smoke.mjs"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing notification consistency audit file: ${file}`);
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

function mustNotMatch(source, file, pattern, label) {
  if (pattern.test(source)) {
    problems.push(`${file} must not contain ${label}.`);
  }
}

function mustContainAny(source, file, tokens, label) {
  if (!tokens.some((token) => source.includes(token))) {
    problems.push(`${file} must contain one of ${label}: ${JSON.stringify(tokens)}.`);
  }
}

function mustContainAnyCaseInsensitive(source, file, tokens, label) {
  const lowerSource = source.toLowerCase();
  if (!tokens.some((token) => lowerSource.includes(token.toLowerCase()))) {
    problems.push(`${file} must contain one of ${label}: ${JSON.stringify(tokens)}.`);
  }
}

if (problems.length === 0) {
  checkApiNotificationRoutesAndServices();
  checkDeliveryReadinessBoundaries();
  checkNoSensitiveNotificationMetadata();
  checkSurfaceConsistency();
  checkExistingGuardsAndScripts();
  checkDocs();
}

function checkApiNotificationRoutesAndServices() {
  const routes = read("apps/api/src/routes/notifications.routes.ts");
  const adminRoutes = read("apps/api/src/routes/admin-notifications.routes.ts");
  const notificationsService = read("apps/api/src/services/notifications.service.ts");

  for (const token of [
    "/notifications",
    "/notifications/unread-count",
    "/notifications/:id/read",
    "/notifications/read-all",
    "/notifications/delivery-drafts",
    "/notifications/child-lifecycle/generate",
    "/notifications/saved-searches/generate",
    "requireCurrentUser",
    "markNotificationRead",
    "markAllNotificationsRead",
    "emitNotificationRead",
    "emitNotificationReadAll",
    "emitUnreadNotificationCountUpdated"
  ]) {
    mustContain(routes, "apps/api/src/routes/notifications.routes.ts", token);
  }

  for (const token of [
    "/admin/notifications/ops-preview",
    "requireAdminUser",
    "getAdminNotificationOpsPreview"
  ]) {
    mustContain(adminRoutes, "apps/api/src/routes/admin-notifications.routes.ts", token);
  }

  for (const token of [
    "assertSafePlainText",
    "safePlainTextFallback",
    "sanitizeFavoriteNotificationMetadata",
    "markMessageNotificationsReadForConversation",
    "recipientProfileId",
    "actorProfile"
  ]) {
    mustContain(notificationsService, "apps/api/src/services/notifications.service.ts", token);
  }

  for (const forbidden of [
    "passwordHash",
    "refreshTokenHash",
    "accessToken:",
    "refreshToken:",
    "document.cookie",
    "localStorage",
    "sessionStorage"
  ]) {
    mustNotMatch(notificationsService, "apps/api/src/services/notifications.service.ts", new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"), forbidden);
  }
}

function checkDeliveryReadinessBoundaries() {
  const deliveryPolicy = read("apps/api/src/services/notification-delivery-policy.service.ts");
  const deliveryDrafts = read("apps/api/src/services/notification-delivery-drafts.service.ts");
  const deliveryLog = read("apps/api/src/services/notification-delivery-log.service.ts");
  const transitions = read("apps/api/src/services/notification-delivery-transitions.service.ts");
  const consent = read("apps/api/src/services/notification-consent-preference-policy.service.ts");
  const push = read("apps/api/src/services/notification-push-readiness.service.ts");
  const n8n = read("apps/api/src/services/notification-n8n-readiness.service.ts");
  const observability = read("apps/api/src/services/notification-observability-taxonomy.service.ts");
  const qa = read("apps/api/src/services/notification-preference-qa-readiness.service.ts");
  const adminOps = read("apps/api/src/services/admin-notification-ops.service.ts");

  for (const token of [
    "deliveryAllowed: false",
    "draftOnly: true",
    "provider_not_configured",
    "frequency_policy_required",
    "dedup_required",
    "consentRequired: true",
    "deliveryLogRequired: true",
    "idempotencyRequired: true",
    "auditRequired: true"
  ]) {
    mustContain(deliveryPolicy, "apps/api/src/services/notification-delivery-policy.service.ts", token);
  }

  for (const token of [
    "status: \"draft_only\"",
    "channel: \"email_draft\"",
    "channel: \"in_app\"",
    "deliveryAllowed: policy.deliveryAllowed",
    "draftOnly: policy.draftOnly",
    "evaluateNotificationDeliveryPolicy"
  ]) {
    mustContain(deliveryDrafts, "apps/api/src/services/notification-delivery-drafts.service.ts", token);
  }

  for (const token of [
    "deliveryAllowed: false",
    "draftOnly: true",
    "idempotencyKey",
    "dedupKey",
    "frequencyWindowHours",
    "sanitizeNotificationDeliveryMetadata",
    "isSensitiveNotificationDeliveryMetadataKey",
    "createNotificationDeliveryCandidateLog"
  ]) {
    mustContain(deliveryLog, "apps/api/src/services/notification-delivery-log.service.ts", token);
  }

  for (const token of [
    "deliveryAllowed: false",
    "draftOnly: true",
    "targetStatus === \"sent\"",
    "delivery_disabled",
    "provider_not_configured",
    "adminAudit: true",
    "providerSandbox: true",
    "sanitizeTransitionAuditMetadata"
  ]) {
    mustContain(transitions, "apps/api/src/services/notification-delivery-transitions.service.ts", token);
  }

  for (const token of [
    "providerCallAllowed: false",
    "deliveryMutationAllowed: false",
    "rawContactLoggingAllowed: false",
    "preferenceRequiredBeforeDelivery: true",
    "auditRequired: true",
    "blockedBySafety"
  ]) {
    mustContain(consent, "apps/api/src/services/notification-consent-preference-policy.service.ts", token);
  }

  for (const token of [
    "pushSenderEnabled: false",
    "providerConfigured: false",
    "tokenRegistryEnabled: true",
    "tokenCollectionAllowed: false",
    "deliveryAllowed: false",
    "draftOnly: true"
  ]) {
    mustContain(push, "apps/api/src/services/notification-push-readiness.service.ts", token);
  }

  for (const token of [
    "n8nWorkflowEnabled: false",
    "webhookConfigured: false",
    "webhookCallsAllowed: false",
    "queueEnabled: false",
    "deliveryAllowed: false",
    "draftOnly: true"
  ]) {
    mustContain(n8n, "apps/api/src/services/notification-n8n-readiness.service.ts", token);
  }

  for (const token of [
    "rawPayloadLoggingAllowed: false",
    "piiLoggingAllowed: false",
    "metricsEnabled: false",
    "tracingEnabled: false",
    "allowEmail: false",
    "allowPhone: false",
    "allowToken: false",
    "allowCookie: false"
  ]) {
    mustContain(observability, "apps/api/src/services/notification-observability-taxonomy.service.ts", token);
  }

  for (const token of [
    "providerCallsAllowed: false",
    "deliveryEnabled: false",
    "rawContactLoggingAllowed: false",
    "manualQaRequired: true",
    "backofficeQaRequired: true",
    "mobileQaRequired: true",
    "webQaRequired: true"
  ]) {
    mustContain(qa, "apps/api/src/services/notification-preference-qa-readiness.service.ts", token);
  }

  for (const token of [
    "sendEnabled: false",
    "queueEnabled: false",
    "emailEnabled: false",
    "pushEnabled: false",
    "n8nEnabled: false",
    "deliveryAllowed: false",
    "draftOnly: true",
    "privacyNote"
  ]) {
    mustContain(adminOps, "apps/api/src/services/admin-notification-ops.service.ts", token);
  }
}

function checkNoSensitiveNotificationMetadata() {
  const files = [
    "apps/api/src/services/notification-delivery-drafts.service.ts",
    "apps/api/src/services/notification-delivery-log.service.ts",
    "apps/api/src/services/notification-delivery-transitions.service.ts",
    "apps/api/src/services/admin-notification-ops.service.ts",
    "apps/api/src/services/notification-observability-taxonomy.service.ts",
    "apps/mobile/src/features/notifications/notifications-api.ts",
    "apps/mobile/src/features/notifications/notifications-model.ts",
    "apps/mobile/src/features/notifications/notification-preferences-model.ts",
    "apps/mobile/src/features/child/child-reminders-api.ts",
    "apps/mobile/src/features/child/child-reminders-model.ts",
    "apps/web/src/features/notifications/api.ts",
    "apps/web/src/features/notification-preferences/api.ts",
    "apps/backoffice/src/features/notifications/notification-ops-page.tsx"
  ];

  const unsafePatterns = [
    [/console\.(log|debug|info)\s*\(/u, "unsafe console logging"],
    [/metadata\s*:\s*[^;\n]*email/iu, "raw email in metadata assignment"],
    [/metadata\s*:\s*[^;\n]*phone/iu, "raw phone in metadata assignment"],
    [/accessToken\s*:/u, "accessToken response field"],
    [/refreshToken\s*:/u, "refreshToken response field"],
    [/passwordHash\s*:/u, "passwordHash response field"],
    [/document\.cookie/u, "document.cookie access"],
    [/localStorage/u, "localStorage notification storage"],
    [/sessionStorage/u, "sessionStorage notification storage"]
  ];

  for (const file of files) {
    const source = read(file);
    for (const [pattern, label] of unsafePatterns) {
      mustNotMatch(source, file, pattern, label);
    }
  }
}

function checkSurfaceConsistency() {
  const mobileApi = read("apps/mobile/src/features/notifications/notifications-api.ts");
  const mobileApiTest = read("apps/mobile/src/features/notifications/notifications-api.test.ts");
  const mobileModel = read("apps/mobile/src/features/notifications/notifications-model.ts");
  const mobileModelTest = read("apps/mobile/src/features/notifications/notifications-model.test.ts");
  const mobilePreferenceModel = read("apps/mobile/src/features/notifications/notification-preferences-model.ts");
  const mobilePreferenceModelTest = read("apps/mobile/src/features/notifications/notification-preferences-model.test.ts");
  const childReminderApi = read("apps/mobile/src/features/child/child-reminders-api.ts");
  const childReminderModel = read("apps/mobile/src/features/child/child-reminders-model.ts");
  const webNotificationsApi = read("apps/web/src/features/notifications/api.ts");
  const webPreferenceApi = read("apps/web/src/features/notification-preferences/api.ts");
  const webPreferencePage = read("apps/web/src/features/notification-preferences/notification-preferences-page-content.tsx");
  const backofficeOps = read("apps/backoffice/src/features/notifications/notification-ops-page.tsx");
  const backofficeOpsTest = read("apps/backoffice/src/features/notifications/notification-ops-page.test.tsx");

  for (const token of [
    "/notifications",
    "/notifications/unread-count",
    "/notifications/read-all",
    "/notifications/delivery-drafts"
  ]) {
    mustContain(mobileApi + webNotificationsApi + webPreferenceApi, "notification API clients", token);
  }

  const mobileSurface = mobileApi + mobileApiTest + mobileModel + mobileModelTest + mobilePreferenceModel + mobilePreferenceModelTest + childReminderApi + childReminderModel;
  const webPreferenceSurface = webPreferenceApi + webPreferencePage;
  const backofficeNotificationSurface = backofficeOps + backofficeOpsTest;

  for (const token of [
    "draftOnly",
    "email",
    "push",
    "n8n"
  ]) {
    mustContainCaseInsensitive(mobileSurface, "mobile notification surface", token);
    mustContainCaseInsensitive(webPreferenceSurface, "web notification preference surface", token);
    mustContainCaseInsensitive(backofficeNotificationSurface, "backoffice notification ops surface", token);
  }

  mustContainAnyCaseInsensitive(mobileSurface, "mobile notification surface", [
    "deliveryAllowed",
    "deliveryEnabled",
    "delivery enabled",
    "delivery disabled",
    "providerCallsAllowed",
    "provider calls allowed",
    "draftOnly"
  ], "mobile delivery-disabled contract");

  mustContainCaseInsensitive(webPreferenceSurface, "web notification preference surface", "deliveryAllowed");
  mustContainCaseInsensitive(backofficeNotificationSurface, "backoffice notification ops surface", "deliveryAllowed");

  for (const token of [
    "deliveryAllowed: false",
    "draftOnly: true",
    "sendEnabled",
    "queueEnabled",
    "emailEnabled",
    "pushEnabled",
    "n8nEnabled"
  ]) {
    mustContainCaseInsensitive(backofficeOps + backofficeOpsTest, "backoffice notification ops surface", token);
  }
}

function checkExistingGuardsAndScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};

  const requiredScripts = [
    "security:mobile-notifications",
    "security:notification-consent-preference",
    "security:notification-delivery-log",
    "security:notification-delivery-transitions",
    "security:notification-n8n-readiness",
    "security:notification-observability-taxonomy",
    "security:notification-ops-preview",
    "security:notification-preference-qa",
    "security:notification-push-readiness",
    "security:notification-sender-provider-design",
    "security:notification-consistency-audit"
  ];

  for (const scriptName of requiredScripts) {
    if (!scripts[scriptName]) {
      problems.push(`package.json must define ${scriptName}.`);
    }
  }

  const aggregate = scripts["test:api:security"] ?? "";
  for (const scriptName of [
    "security:notification-consistency-audit",
    "security:notification-consent-preference",
    "security:notification-delivery-log",
    "security:notification-delivery-transitions",
    "security:notification-n8n-readiness",
    "security:notification-observability-taxonomy",
    "security:notification-ops-preview",
    "security:notification-preference-qa",
    "security:notification-push-readiness",
    "security:notification-sender-provider-design"
  ]) {
    mustContain(aggregate, "package.json#test:api:security", `pnpm ${scriptName}`);
  }

  const mobileRelease = scripts["release:mobile:p0"] ?? "";
  mustContain(mobileRelease, "package.json#release:mobile:p0", "pnpm security:mobile-notifications");

  const runner = read("scripts/run-beta-critical-smoke.mjs");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Notification consistency audit boundary guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:notification-consistency-audit");
}

function checkDocs() {
  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/30-rag-architecture.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/56-mobile-scope-freeze.md",
    "docs/61-notification-sender-provider-design-gate.md",
    "docs/62-notification-observability-taxonomy.md",
    "docs/63-notification-consent-preference-policy.md",
    "docs/66-notification-preference-qa-gate.md",
    "docs/70-notification-surface-consistency-audit.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "Notification surface consistency audit");
    mustContain(source, file, "pnpm security:notification-consistency-audit");
    mustContainCaseInsensitive(source, file, "draft-only");
    mustContainCaseInsensitive(source, file, "deliveryAllowed=false");
    mustContainCaseInsensitive(source, file, "email/push/n8n");
    mustContainCaseInsensitive(source, file, "does not enable real email sending");
    mustContainCaseInsensitive(source, file, "does not enable real push sending");
    mustContainCaseInsensitive(source, file, "does not enable real n8n workflow triggering");
  }

  const mainDoc = read("docs/70-notification-surface-consistency-audit.md");
  for (const token of [
    "API",
    "web",
    "mobile",
    "backoffice",
    "notification preferences",
    "delivery drafts",
    "push readiness",
    "n8n readiness",
    "observability",
    "manual QA"
  ]) {
    mustContainCaseInsensitive(mainDoc, "docs/70-notification-surface-consistency-audit.md", token);
  }
}

if (problems.length > 0) {
  console.error("Notification surface consistency audit failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification surface consistency audit passed.");

import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/notification-provider-execution.service.ts",
  "apps/api/src/services/notification-push-token-registry.service.ts",
  "apps/api/src/scripts/process-notification-deliveries.ts",
  "apps/api/test/notification-provider-execution.service.test.ts",
  "packages/database/src/schema/index.ts",
  "packages/database/drizzle/0027_notification_provider_execution.sql",
  "apps/api/src/services/admin-notification-ops.service.ts",
  "apps/backoffice/src/features/notifications/notification-ops-page.tsx",
  "docs/76-core-safety-child-foundation.md",
  "docs/77-notification-marketplace-core.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing notification provider execution file: ${file}`);
  }
}

function read(file) {
  return readFileSync(`${process.cwd()}/${file}`, "utf8");
}

function mustContain(source, file, token) {
  if (!source.includes(token)) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function mustNotContain(source, file, pattern, label) {
  if (pattern.test(source)) {
    problems.push(`${file} must not contain ${label}.`);
  }
}

if (problems.length === 0) {
  const service = read("apps/api/src/services/notification-provider-execution.service.ts");
  const registry = read("apps/api/src/services/notification-push-token-registry.service.ts");
  const tests = read("apps/api/test/notification-provider-execution.service.test.ts");
  const schema = read("packages/database/src/schema/index.ts");
  const migration = read("packages/database/drizzle/0027_notification_provider_execution.sql");
  const adminOps = read("apps/api/src/services/admin-notification-ops.service.ts");
  const backofficePage = read("apps/backoffice/src/features/notifications/notification-ops-page.tsx");
  const packageJson = JSON.parse(read("package.json"));
  const scripts = packageJson.scripts ?? {};
  const betaRunner = read("scripts/run-beta-critical-smoke.mjs");
  const betaBoundary = read("scripts/check-beta-critical-smoke-boundary.mjs");
  const docs76 = read("docs/76-core-safety-child-foundation.md");
  const docs77 = read("docs/77-notification-marketplace-core.md");

  for (const token of [
    "executeNotificationProviderDelivery",
    "processPendingNotificationProviderDeliveries",
    "N8N_NOTIFICATION_WEBHOOK_URL",
    "RESEND_API_KEY",
    "EXPO_ACCESS_TOKEN",
    "x-idempotency-key",
    "idempotency-key",
    "provider_disabled",
    "recipient_email_unverified",
    "preference_disabled",
    "DeviceNotRegistered",
    "sanitizeProviderResponseMeta",
    "sanitizeErrorMessage"
  ]) {
    mustContain(service, "apps/api/src/services/notification-provider-execution.service.ts", token);
  }

  for (const token of [
    "tokenCiphertext",
    "tokenNonce",
    "tokenTag",
    "aes-256-gcm",
    "listNotificationPushTokensForDelivery",
    "revokeNotificationPushTokenById"
  ]) {
    mustContain(registry, "apps/api/src/services/notification-push-token-registry.service.ts", token);
  }

  for (const token of [
    "provider",
    "providerStatus",
    "providerMessageId",
    "attemptCount",
    "lastAttemptAt",
    "nextAttemptAt",
    "lastErrorMessageRedacted",
    "providerResponseMeta",
    "tokenCiphertext"
  ]) {
    mustContain(schema, "packages/database/src/schema/index.ts", token);
    mustContain(migration, "packages/database/drizzle/0027_notification_provider_execution.sql", token.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`));
  }

  for (const token of [
    "skips provider execution without env and does not call network",
    "executes n8n webhook with idempotency and allowlisted payload",
    "sends verified Resend email",
    "sends Expo push",
    "not.toMatch(/"
  ]) {
    mustContain(tests, "apps/api/test/notification-provider-execution.service.test.ts", token);
  }

  for (const token of [
    "provider",
    "providerStatus",
    "attemptCount",
    "lastErrorMessageRedacted",
    "provider secret"
  ]) {
    mustContain(adminOps, "apps/api/src/services/admin-notification-ops.service.ts", token);
    mustContain(backofficePage, "apps/backoffice/src/features/notifications/notification-ops-page.tsx", token);
  }

  for (const token of [
    "N8N_NOTIFICATION_WEBHOOK_URL",
    "RESEND_API_KEY",
    "EXPO_ACCESS_TOKEN",
    "provider_disabled",
    "retry",
    "idempotency",
    "No real SMS send"
  ]) {
    mustContain(`${docs76}\n${docs77}`, "docs/76+77", token);
  }

  mustContain(scripts["security:notification-provider-execution"] ?? "", "package.json#security:notification-provider-execution", "node scripts/check-notification-provider-execution-boundary.mjs");
  mustContain(scripts["test:api:security"] ?? "", "package.json#test:api:security", "pnpm security:notification-provider-execution");
  mustContain(scripts["release:mobile:p0"] ?? "", "package.json#release:mobile:p0", "pnpm security:notification-provider-execution");
  mustContain(betaRunner, "scripts/run-beta-critical-smoke.mjs", "security:notification-provider-execution");
  mustContain(betaBoundary, "scripts/check-beta-critical-smoke-boundary.mjs", "security:notification-provider-execution");

  for (const [file, source] of [
    ["apps/api/src/services/notification-provider-execution.service.ts", service],
    ["apps/api/src/services/notification-push-token-registry.service.ts", registry],
    ["apps/api/src/services/admin-notification-ops.service.ts", adminOps]
  ]) {
    mustNotContain(source, file, /console\.(log|debug|info)\([^)]*(api[_-]?key|secret|token|authorization|cookie|password)/iu, "raw sensitive console logging");
    mustNotContain(source, file, /providerResponseMeta:\s*row\.metadata/iu, "raw metadata provider response exposure");
    mustNotContain(source, file, /localStorage\.setItem|sessionStorage\.setItem|document\.cookie|AsyncStorage\.setItem/iu, "client token persistence");
  }
}

if (problems.length > 0) {
  console.error("Notification provider execution boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification provider execution boundary passed.");

import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "packages/database/drizzle/0023_notification_delivery_logs.sql",
  "packages/database/src/schema/index.ts",
  "apps/api/src/services/notification-delivery-log.service.ts",
  "apps/api/test/notification-delivery-log.service.test.ts",
  "apps/api/src/services/notification-delivery-policy.service.ts",
  "apps/api/test/notification-delivery-policy.service.test.ts",
  "apps/api/src/services/notification-delivery-drafts.service.ts",
  "apps/api/src/services/admin-notification-ops.service.ts",
  "docs/25-validation-and-regression-checklist.md",
  "docs/30-rag-architecture.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required notification delivery log boundary file: ${file}`);
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
  checkMigrationAndSchema();
  checkServiceAndTests();
  checkExistingPolicyBoundary();
  checkScriptsAndDocs();
}

function checkMigrationAndSchema() {
  const migrationFile = "packages/database/drizzle/0023_notification_delivery_logs.sql";
  const schemaFile = "packages/database/src/schema/index.ts";
  const migration = read(migrationFile);
  const schema = read(schemaFile);

  for (const token of [
    "CREATE TABLE IF NOT EXISTS \"notification_delivery_logs\"",
    "\"idempotency_key\" varchar(240) NOT NULL",
    "\"dedup_key\" varchar(240) NOT NULL",
    "\"frequency_window_hours\" integer NOT NULL",
    "\"delivery_allowed\" boolean DEFAULT false NOT NULL",
    "\"draft_only\" boolean DEFAULT true NOT NULL",
    "\"blocked_reasons\" jsonb DEFAULT '[]'::jsonb NOT NULL",
    "notification_delivery_logs_idempotency_key_unique",
    "notification_delivery_logs_dedup_created_at_idx",
    "notification_delivery_logs_profile_created_at_idx",
    "notification_delivery_logs_profile_id_profiles_id_fk"
  ]) {
    mustContain(migration, migrationFile, token);
  }

  for (const token of [
    "export const notificationDeliveryLogs = pgTable",
    "\"notification_delivery_logs\"",
    "idempotencyKey: varchar(\"idempotency_key\", { length: 240 }).notNull()",
    "dedupKey: varchar(\"dedup_key\", { length: 240 }).notNull()",
    "frequencyWindowHours: integer(\"frequency_window_hours\").notNull()",
    "deliveryAllowed: boolean(\"delivery_allowed\").notNull().default(false)",
    "draftOnly: boolean(\"draft_only\").notNull().default(true)",
    "blockedReasons: jsonb(\"blocked_reasons\")",
    "uniqueIndex(\"notification_delivery_logs_idempotency_key_unique\").on(table.idempotencyKey)",
    "index(\"notification_delivery_logs_dedup_created_at_idx\").on(table.dedupKey, table.createdAt)"
  ]) {
    mustContain(schema, schemaFile, token);
  }
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/notification-delivery-log.service.ts";
  const testFile = "apps/api/test/notification-delivery-log.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "notificationDeliveryLogs",
    "buildNotificationDeliveryLogRecord",
    "buildNotificationDeliveryIdempotencyKey",
    "isNotificationDeliveryWithinFrequencyWindow",
    "canWriteNotificationDeliveryCandidateLog",
    "createNotificationDeliveryCandidateLog",
    "deliveryAllowed: false",
    "draftOnly: true",
    "frequency_window_active",
    "sanitizeNotificationDeliveryMetadata",
    "isSensitiveNotificationDeliveryMetadataKey",
    "onConflictDoNothing"
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
    "builds a stable draft-only candidate log without enabling delivery",
    "deliveryAllowed: false",
    "draftOnly: true",
    "delivery_log_required",
    "blocks duplicate candidate writes inside the frequency window",
    "allows candidate writes after the frequency window expires",
    "not.toMatch(/parent@example.com|secret-token|raw body|accessToken|refreshToken|passwordHash|otpCode/iu"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkExistingPolicyBoundary() {
  const policyFile = "apps/api/src/services/notification-delivery-policy.service.ts";
  const policyTestFile = "apps/api/test/notification-delivery-policy.service.test.ts";
  const draftsFile = "apps/api/src/services/notification-delivery-drafts.service.ts";
  const opsFile = "apps/api/src/services/admin-notification-ops.service.ts";

  const policy = read(policyFile);
  const policyTests = read(policyTestFile);
  const drafts = read(draftsFile);
  const ops = read(opsFile);

  for (const token of [
    "deliveryAllowed: false",
    "draftOnly: true",
    "delivery_log_required",
    "idempotencyRequired: true",
    "frequencyWindowHours",
    "idempotency key for n8n/email hooks"
  ]) {
    mustContain(policy, policyFile, token);
  }

  for (const token of [
    "expect(result.deliveryAllowed).toBe(false)",
    "expect(result.draftOnly).toBe(true)",
    "expect(result.requirements.deliveryLogRequired).toBe(true)",
    "expect(result.requirements.idempotencyRequired).toBe(true)"
  ]) {
    mustContain(policyTests, policyTestFile, token);
  }

  for (const token of [
    "status: \"draft_only\"",
    "draftOnly: true",
    "evaluateNotificationDeliveryPolicy",
    "email, push, n8n veya in-app bildirim göndermez"
  ]) {
    mustContain(drafts, draftsFile, token);
  }

  for (const token of [
    "draftOnly: true",
    "dedupRequired: true",
    "Webhook yalnızca delivery log + retry + idempotency sonrası açılmalı.",
    "notification_delivery_logs schema ve admin audit bağlantısı",
    "n8n webhook idempotency token"
  ]) {
    mustContain(ops, opsFile, token);
  }
}

function checkScriptsAndDocs() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const securityScript = scripts["security:notification-delivery-log"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(securityScript, "package.json#security:notification-delivery-log", "node scripts/check-notification-delivery-log-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:notification-delivery-log");

  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/30-rag-architecture.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "notification delivery log foundation");
    mustContain(source, file, "pnpm security:notification-delivery-log");
    mustContainCaseInsensitive(source, file, "idempotency");
    mustContainCaseInsensitive(source, file, "frequency window");
    mustContainCaseInsensitive(source, file, "deliveryAllowed=false");
  }
}

if (problems.length > 0) {
  console.error("Notification delivery log boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification delivery log boundary guard passed.");

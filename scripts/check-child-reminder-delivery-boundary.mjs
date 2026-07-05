import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "packages/database/drizzle/0024_notification_delivery_child_reminder_kind.sql",
  "apps/api/src/services/child-reminder-delivery-candidates.service.ts",
  "apps/api/test/child-reminder-delivery-candidates.service.test.ts",
  "apps/api/src/services/notification-delivery-policy.service.ts",
  "apps/api/src/services/notification-delivery-log.service.ts",
  "docs/25-validation-and-regression-checklist.md",
  "docs/30-rag-architecture.md",
  "docs/43-child-profile-lifecycle-and-devops-roadmap.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required child reminder delivery boundary file: ${file}`);
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
  checkMigration();
  checkPolicy();
  checkServiceAndTests();
  checkScriptsAndDocs();
}

function checkMigration() {
  const file = "packages/database/drizzle/0024_notification_delivery_child_reminder_kind.sql";
  const source = read(file);

  for (const token of [
    "DROP CONSTRAINT IF EXISTS \"notification_delivery_logs_kind_check\"",
    "'child_lifecycle', 'saved_search', 'child_reminder'",
    "notification_delivery_logs_kind_check"
  ]) {
    mustContain(source, file, token);
  }
}

function checkPolicy() {
  const file = "apps/api/src/services/notification-delivery-policy.service.ts";
  const source = read(file);

  for (const token of [
    "\"child_reminder\"",
    "input.kind === \"child_reminder\"",
    "return 24;"
  ]) {
    mustContain(source, file, token);
  }
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/child-reminder-delivery-candidates.service.ts";
  const testFile = "apps/api/test/child-reminder-delivery-candidates.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "buildChildReminderDeliveryPolicyInput",
    "buildChildReminderDeliveryCandidate",
    "createChildReminderDeliveryCandidateLog",
    "kind: \"child_reminder\"",
    "sourceType: \"child_profile\"",
    "deliveryAllowed: false",
    "draftOnly: true",
    "frequency_window_active",
    "buildNotificationDeliveryLogRecord",
    "createNotificationDeliveryCandidateLog",
    "email, push veya n8n gönderimi yapmaz"
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
    "builds a draft-only child reminder candidate without enabling delivery",
    "uses stable policy input for child reminder idempotency",
    "blocks duplicate child reminder candidates inside the frequency window",
    "skips completed reminders instead of creating delivery candidates",
    "supports email_draft reminders without sending email",
    "not.toMatch(/parent@example.com|accessToken|refreshToken|passwordHash|otpCode|cookie|authorization|sendPush|sendEmail|n8n hook/iu"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkScriptsAndDocs() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const securityScript = scripts["security:child-reminder-delivery"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(securityScript, "package.json#security:child-reminder-delivery", "node scripts/check-child-reminder-delivery-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:child-reminder-delivery");

  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/30-rag-architecture.md",
    "docs/43-child-profile-lifecycle-and-devops-roadmap.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "child reminder delivery candidate pipeline");
    mustContain(source, file, "pnpm security:child-reminder-delivery");
    mustContainCaseInsensitive(source, file, "deliveryAllowed=false");
    mustContainCaseInsensitive(source, file, "draftOnly=true");
    mustContainCaseInsensitive(source, file, "email/push/n8n");
  }
}

if (problems.length > 0) {
  console.error("Child reminder delivery boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Child reminder delivery boundary guard passed.");

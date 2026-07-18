#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/child-reminder-delivery-candidates.service.ts",
  "apps/api/test/child-reminder-delivery-candidates.service.test.ts",
  "apps/api/src/schemas/child-profile-notes-reminders.schemas.ts",
  "apps/api/src/routes/child-profiles.routes.ts",
  "apps/api/src/services/notification-consent-preference-policy.service.ts",
  "apps/api/src/services/notification-delivery-policy.service.ts",
  "scripts/check-child-reminder-api-schedule-boundary.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "docs/67-child-reminder-api-scheduling-boundary.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing child reminder API scheduling boundary file: ${file}`);
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
  checkApiContract();
  checkPackageAndBetaSmoke();
  checkDocs();
  checkNoRealDelivery();
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/child-reminder-delivery-candidates.service.ts";
  const testFile = "apps/api/test/child-reminder-delivery-candidates.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "ChildReminderDeliverySkipReason",
    "getChildReminderDeliveryCandidateSkipReason",
    "reminder_not_scheduled",
    "reminder_not_due",
    "reminder_invalid_date",
    "remindAt.getTime() > now.getTime()",
    "deliveryAllowed: false",
    "draftOnly: true",
    "frequency_window_active",
    "email, push veya n8n gönderimi yapmaz"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const token of [
    "skips future reminders until remindAt is due",
    "reports invalid reminder dates as skipped without provider calls",
    "blocks duplicate child reminder candidates inside the frequency window",
    "skips completed reminders instead of creating delivery candidates",
    "supports email_draft reminders without sending email",
    "reminder_not_due",
    "reminder_invalid_date",
    "not.toMatch(/parent@example.com|accessToken|refreshToken|passwordHash|otpCode|cookie|authorization|sendPush|sendEmail|n8n hook/iu"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkApiContract() {
  const schemaFile = "apps/api/src/schemas/child-profile-notes-reminders.schemas.ts";
  const routeFile = "apps/api/src/routes/child-profiles.routes.ts";
  const consentFile = "apps/api/src/services/notification-consent-preference-policy.service.ts";
  const policyFile = "apps/api/src/services/notification-delivery-policy.service.ts";

  const schema = read(schemaFile);
  const route = read(routeFile);
  const consent = read(consentFile);
  const policy = read(policyFile);

  for (const token of [
    "childProfileReminderChannelSchema",
    "z.enum([\"in_app\", \"email_draft\"])",
    "childProfileReminderStatusSchema",
    "z.enum([\"scheduled\", \"completed\", \"cancelled\"])",
    "const dateInputSchema = z",
    "remindAt: dateInputSchema.optional()",
    "channel: childProfileReminderChannelSchema.optional().default(\"in_app\")"
  ]) {
    mustContain(schema, schemaFile, token);
  }

  for (const token of [
    "/child-profiles/:childProfileId/reminders",
    "createChildProfileReminder",
    "updateChildProfileReminder",
    "cancelChildProfileReminder",
    "requireCurrentUser"
  ]) {
    mustContain(route, routeFile, token);
  }

  for (const token of [
    "\"child_reminder\"",
    "consentRequiredBeforeDelivery: true",
    "preferenceRequiredBeforeDelivery: true",
    "deliveryMutationAllowed: false",
    "providerCallAllowed: false"
  ]) {
    mustContain(consent, consentFile, token);
  }

  for (const token of [
    "kind === \"child_reminder\"",
    "return 24;",
    "deliveryAllowed: false",
    "draftOnly: true",
    "consentRequired: true"
  ]) {
    mustContain(policy, policyFile, token);
  }
}

function checkPackageAndBetaSmoke() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};

  mustContain(
    scripts["security:child-reminder-api-schedule"] ?? "",
    "package.json#security:child-reminder-api-schedule",
    "node scripts/check-child-reminder-api-schedule-boundary.mjs"
  );
  mustContain(
    scripts["test:api:security"] ?? "",
    "package.json#test:api:security",
    "pnpm security:child-reminder-api-schedule"
  );

  const runner = read("scripts/run-beta-critical-smoke.mjs");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Child reminder API schedule guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:child-reminder-api-schedule");
}

function checkDocs() {
  for (const file of [
    "docs/67-child-reminder-api-scheduling-boundary.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ]) {
    const source = read(file);

    mustContainCaseInsensitive(source, file, "child reminder API scheduling boundary");
    mustContain(source, file, "pnpm security:child-reminder-api-schedule");
    mustContain(source, file, "reminder_not_due");
    mustContain(source, file, "reminder_invalid_date");
    mustContainCaseInsensitive(source, file, "does not run queue jobs");
    mustContainCaseInsensitive(source, file, "does not send email");
    mustContainCaseInsensitive(source, file, "does not send push");
    mustContainCaseInsensitive(source, file, "does not trigger n8n");
  }
}

function checkNoRealDelivery() {
  for (const file of [
    "apps/api/src/services/child-reminder-delivery-candidates.service.ts",
    "docs/67-child-reminder-api-scheduling-boundary.md"
  ]) {
    const source = read(file);

    for (const forbidden of [
      "sendPush(",
      "sendEmail(",
      "sendN8n(",
      "triggerN8n(",
      "queue.add",
      "bullmq",
      "resend.emails.send",
      "expo-notifications",
      "firebase-admin",
      "EMAIL_SEND_ENABLED=true",
      "N8N_WEBHOOK_URL=",
      "WEBHOOK_SECRET=",
      "deliveryAllowed: true",
      "draftOnly: false"
    ]) {
      mustNotContain(source, file, forbidden);
    }
  }
}

if (problems.length > 0) {
  console.error("Child reminder API scheduling boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Child reminder API scheduling boundary passed.");

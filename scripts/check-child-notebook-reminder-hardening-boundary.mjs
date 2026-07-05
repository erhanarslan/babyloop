import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/child-notebook-reminder-policy.service.ts",
  "apps/api/test/child-notebook-reminder-policy.service.test.ts",
  "scripts/check-child-notebook-reminder-hardening-boundary.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "scripts/check-beta-critical-smoke-boundary.mjs",
  "docs/65-child-notebook-reminder-hardening-gate.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/56-mobile-real-device-s22-qa-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required child notebook/reminder hardening file: ${file}`);
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
  checkNoRuntimeSchedulingOrSecrets();
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/child-notebook-reminder-policy.service.ts";
  const testFile = "apps/api/test/child-notebook-reminder-policy.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "evaluateChildNotebookReminder",
    "getChildNotebookReminderReadiness",
    "assertChildNotebookReminderReadinessOnly",
    "free_note",
    "feeding",
    "diaper",
    "shopping",
    "activity",
    "appointment",
    "every_hours",
    "one_week_before",
    "one_day_before",
    "same_day",
    "notificationPreferenceEnabled",
    "requiresNotificationPreference: true",
    "requiresOwnerAccess: true",
    "deliveryMutationAllowed: false",
    "providerCallAllowed: false",
    "medicalAdviceAllowed: false",
    "therapyAdviceAllowed: false",
    "drugAdviceAllowed: false",
    "dietPrescriptionAllowed: false",
    "runtimeCrudEnabled: false",
    "notificationDeliveryEnabled: false",
    "queueJobsAllowed: false"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const forbidden of [
    "runtimeCrudEnabled: true",
    "notificationDeliveryEnabled: true",
    "providerCallsAllowed: true",
    "queueJobsAllowed: true",
    "deliveryMutationAllowed: true",
    "providerCallAllowed: true",
    "medicalAdviceAllowed: true",
    "console.log"
  ]) {
    mustNotContain(service, serviceFile, forbidden);
  }

  for (const token of [
    "accepts a free child note without scheduling delivery",
    "accepts recurring feeding reminders while keeping delivery disabled",
    "accepts appointment reminders with advance notice",
    "blocks invalid reminder inputs and disabled preferences",
    "keeps medical and therapy boundaries closed",
    "exposes readiness-only required flows and disabled runtime delivery",
    "exposes compact readiness-only assertion"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkPackageScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const hardeningScript = scripts["security:child-notebook-reminder-hardening"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(
    hardeningScript,
    "package.json#security:child-notebook-reminder-hardening",
    "node scripts/check-child-notebook-reminder-hardening-boundary.mjs"
  );
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:child-notebook-reminder-hardening");
}

function checkBetaSmokeWiring() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");
  const boundary = read("scripts/check-beta-critical-smoke-boundary.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Child notebook reminder hardening guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:child-notebook-reminder-hardening");
  mustContain(boundary, "scripts/check-beta-critical-smoke-boundary.mjs", "security:child-notebook-reminder-hardening");
}

function checkDocs() {
  const docs = [
    "docs/65-child-notebook-reminder-hardening-gate.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/56-mobile-real-device-s22-qa-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "child notebook/reminder hardening");
    mustContain(source, file, "pnpm security:child-notebook-reminder-hardening");
    mustContainCaseInsensitive(source, file, "free note");
    mustContainCaseInsensitive(source, file, "recurring reminder");
    mustContainCaseInsensitive(source, file, "advance reminder");
    mustContainCaseInsensitive(source, file, "notification preference");
    mustContainCaseInsensitive(source, file, "web child notebook");
    mustContainCaseInsensitive(source, file, "mobile child notebook");
  }

  const mainDoc = read("docs/65-child-notebook-reminder-hardening-gate.md");
  for (const token of [
    "does not create runtime CRUD",
    "does not schedule queue jobs",
    "does not send notifications",
    "does not call providers",
    "does not trigger n8n",
    "does not provide medical/therapy/diagnosis/drug/diet advice",
    "child notebook/reminder runtime implementation remains blocked until explicit implementation"
  ]) {
    mustContain(mainDoc, "docs/65-child-notebook-reminder-hardening-gate.md", token);
  }
}

function checkNoRuntimeSchedulingOrSecrets() {
  const files = [
    "apps/api/src/services/child-notebook-reminder-policy.service.ts",
    "scripts/check-child-notebook-reminder-hardening-boundary.mjs",
    "docs/65-child-notebook-reminder-hardening-gate.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  const forbiddenTokens = [
    ["parent@", "example.com"],
    ["access-token", "-secret"],
    ["refresh-token", "-secret"],
    ["otp", "-secret"],
    ["queue", ".add"],
    ["sendEmail", "("],
    ["sendPush", "("],
    ["triggerN8n", "("],
    ["executeWorkflow", "("],
    ["fetch", "("],
    ["WEBHOOK", "_SECRET="],
    ["N8N_WEBHOOK", "_URL="],
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
  console.error("Child notebook/reminder hardening boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Child notebook/reminder hardening boundary guard passed.");

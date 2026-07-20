import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/saved-search-delivery-candidates.service.ts",
  "apps/api/test/saved-search-delivery-candidates.service.test.ts",
  "apps/api/src/services/notification-delivery-policy.service.ts",
  "apps/api/src/services/notification-delivery-log.service.ts",
  "apps/api/src/services/saved-search-notifications.service.ts",
  "docs/25-validation-and-regression-checklist.md",
  "docs/30-rag-architecture.md",
  "docs/32-assistant-tools.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required saved-search delivery boundary file: ${file}`);
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
  checkScriptsAndDocs();
  checkExistingBoundaries();
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/saved-search-delivery-candidates.service.ts";
  const testFile = "apps/api/test/saved-search-delivery-candidates.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "buildSavedSearchDeliveryPolicyInput",
    "buildSavedSearchDeliveryCandidate",
    "createSavedSearchDeliveryCandidateLog",
    "buildSavedSearchDeliverySourceId",
    "kind: \"saved_search\"",
    "sourceType: \"saved_search\"",
    "deliveryAllowed: false",
    "draftOnly: true",
    "frequency_window_active",
    "buildNotificationDeliveryLogRecord",
    "createNotificationDeliveryCandidateLog",
    "email, push veya n8n gönderimi yapmaz",
    "safeDeliveryText"
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
    "builds a draft-only saved-search candidate without enabling delivery",
    "uses stable policy input for saved-search/listing idempotency",
    "blocks duplicate saved-search candidates inside the frequency window",
    "supports email_draft candidates without sending email",
    "creates a stable source id from saved search and listing ids",
    "not.toMatch(/parent@example.com|accessToken|refreshToken|passwordHash|otpCode|cookie|authorization|sendPush|sendEmail|n8n hook/iu"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkScriptsAndDocs() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const securityScript = scripts["security:saved-search-delivery"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(securityScript, "package.json#security:saved-search-delivery", "node scripts/check-saved-search-delivery-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:saved-search-delivery");

  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/30-rag-architecture.md",
    "docs/32-assistant-tools.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "saved-search delivery candidate pipeline");
    mustContain(source, file, "pnpm security:saved-search-delivery");
    mustContainCaseInsensitive(source, file, "deliveryAllowed=false");
    mustContainCaseInsensitive(source, file, "draftOnly=true");
    mustContainCaseInsensitive(source, file, "email/push/n8n");
  }
}

function checkExistingBoundaries() {
  const savedSearchFile = "apps/api/src/services/saved-search-notifications.service.ts";
  const policyFile = "apps/api/src/services/notification-delivery-policy.service.ts";
  const savedSearch = read(savedSearchFile);
  const policy = read(policyFile);

  for (const token of [
    "deliveryChannel: \"in_app\"",
    "draftOnly: false",
    "Email, push veya n8n gönderimi yapmaz"
  ]) {
    mustContain(savedSearch, savedSearchFile, token);
  }

  for (const token of [
    "\"saved_search\"",
    "SAVED_SEARCH_FREQUENCY_WINDOW_HOURS",
    "options.deliveryEnabled === true",
    "deliveryAllowed: deliveryEnabled",
    "draftOnly: !deliveryEnabled",
    "delivery_log_required"
  ]) {
    mustContain(policy, policyFile, token);
  }
}

if (problems.length > 0) {
  console.error("Saved-search delivery boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Saved-search delivery boundary guard passed.");

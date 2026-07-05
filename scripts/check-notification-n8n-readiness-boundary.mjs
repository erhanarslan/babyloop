import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/notification-n8n-readiness.service.ts",
  "apps/api/test/notification-n8n-readiness.service.test.ts",
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
    problems.push(`Missing required notification n8n readiness file: ${file}`);
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
  const serviceFile = "apps/api/src/services/notification-n8n-readiness.service.ts";
  const testFile = "apps/api/test/notification-n8n-readiness.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "getNotificationN8nReadinessPreview",
    "assertNotificationN8nDisabled",
    "n8nWorkflowEnabled: false",
    "webhookConfigured: false",
    "webhookCallsAllowed: false",
    "queueEnabled: false",
    "retryEnabled: false",
    "deliveryAllowed: false",
    "draftOnly: true",
    "webhook_contract",
    "signed_webhook_payload",
    "queue_worker",
    "dead_letter_policy",
    "workflowCandidates",
    "child_lifecycle",
    "child_reminder",
    "saved_search"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const forbidden of [
    "sendN8n",
    "triggerN8n",
    "executeWorkflow",
    "fetch(",
    "fetch(\"https://hooks.",
    "N8N_WEBHOOK_URL",
    "WEBHOOK_SECRET=",
    "queue.add",
    "new Queue",
    "BullMQ",
    "console.log"
  ]) {
    mustNotContain(service, serviceFile, forbidden);
  }

  for (const token of [
    "keeps n8n workflows blocked and draft-only",
    "lists requirements before enabling n8n workflow delivery",
    "shows current workflow candidate sources without invoking workflows",
    "exposes a compact n8n-disabled assertion for release gates",
    "not.toMatch(/sendN8n|triggerN8n|executeWorkflow|fetch\\(|https:\\/\\/hooks\\.|N8N_WEBHOOK_URL|WEBHOOK_SECRET=|queue\\.add|bullmq|resend\\.emails\\.send|sendPush/iu"
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
    "getNotificationN8nReadinessPreview",
    "n8nReadinessPreview",
    "n8nWorkflowEnabled",
    "Native push readiness"
  ]) {
    mustContain(ops, opsFile, token);
  }

  for (const token of [
    "n8n workflow readiness",
    "n8nReadinessPreview",
    "n8nWorkflowEnabled",
    "Webhook kapalı",
    "Queue/worker kapalı",
    "Gerçek n8n workflow tetiklemesi yok"
  ]) {
    mustContain(page, pageFile, token);
  }

  for (const token of [
    "n8n workflow readiness",
    "Webhook kapalı",
    "Queue/worker kapalı",
    "Gerçek n8n workflow tetiklemesi yok"
  ]) {
    mustContain(pageTest, pageTestFile, token);
  }
}

function checkScriptsAndDocs() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const securityScript = scripts["security:notification-n8n-readiness"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(securityScript, "package.json#security:notification-n8n-readiness", "node scripts/check-notification-n8n-readiness-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:notification-n8n-readiness");

  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/30-rag-architecture.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "n8n workflow readiness");
    mustContain(source, file, "pnpm security:notification-n8n-readiness");
    mustContainCaseInsensitive(source, file, "webhook");
    mustContainCaseInsensitive(source, file, "queue");
    mustContainCaseInsensitive(source, file, "idempotency");
  }
}

if (problems.length > 0) {
  console.error("Notification n8n readiness boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification n8n readiness boundary guard passed.");

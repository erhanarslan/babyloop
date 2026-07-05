import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "scripts/check-notification-sender-provider-design-boundary.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "scripts/check-beta-critical-smoke-boundary.mjs",
  "docs/61-notification-sender-provider-design-gate.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required notification sender provider design file: ${file}`);
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
  checkPackageScripts();
  checkBetaSmokeWiring();
  checkDocs();
  checkNoProviderSecretsOrRuntimeSenders();
}

function checkPackageScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const providerScript = scripts["security:notification-sender-provider-design"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(
    providerScript,
    "package.json#security:notification-sender-provider-design",
    "node scripts/check-notification-sender-provider-design-boundary.mjs"
  );
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:notification-sender-provider-design");
}

function checkBetaSmokeWiring() {
  const runner = read("scripts/run-beta-critical-smoke.mjs");
  const boundary = read("scripts/check-beta-critical-smoke-boundary.mjs");

  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Notification sender provider design guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:notification-sender-provider-design");
  mustContain(boundary, "scripts/check-beta-critical-smoke-boundary.mjs", "security:notification-sender-provider-design");
}

function checkDocs() {
  const docs = [
    "docs/61-notification-sender-provider-design-gate.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "notification sender provider design gate");
    mustContain(source, file, "pnpm security:notification-sender-provider-design");
    mustContainCaseInsensitive(source, file, "provider selection");
    mustContainCaseInsensitive(source, file, "sandbox");
    mustContainCaseInsensitive(source, file, "consent");
    mustContainCaseInsensitive(source, file, "rate limit");
    mustContainCaseInsensitive(source, file, "retry");
    mustContainCaseInsensitive(source, file, "dead-letter");
    mustContainCaseInsensitive(source, file, "audit");
    mustContainCaseInsensitive(source, file, "rollback");
  }

  const mainDoc = read("docs/61-notification-sender-provider-design-gate.md");
  for (const token of [
    "does not enable real email sending",
    "does not enable real push sending",
    "does not enable real n8n workflow triggering",
    "notification sender implementation remains blocked until explicit implementation",
    "manual approval is required before enabling any real notification sender",
    "draft-only notification readiness must remain honest until provider rollout"
  ]) {
    mustContain(mainDoc, "docs/61-notification-sender-provider-design-gate.md", token);
  }
}

function checkNoProviderSecretsOrRuntimeSenders() {
  const files = [
    "scripts/check-notification-sender-provider-design-boundary.mjs",
    "docs/61-notification-sender-provider-design-gate.md",
    "docs/54-production-env-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ];

  const forbiddenTokens = [
    ["RESEND", "_API_KEY="],
    ["SENDGRID", "_API_KEY="],
    ["POSTMARK", "_SERVER_TOKEN="],
    ["EXPO_ACCESS", "_TOKEN="],
    ["FIREBASE_PRIVATE", "_KEY="],
    ["FCM_SERVER", "_KEY="],
    ["APNS_AUTH", "_KEY="],
    ["N8N_WEBHOOK", "_URL="],
    ["WEBHOOK", "_SECRET="],
    ["sendEmail", "("],
    ["sendPush", "("],
    ["triggerN8n", "("],
    ["executeWorkflow", "("],
    ["queue", ".add"],
    ["fetch", "("],
    ["curl https://", "hooks."],
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
  console.error("Notification sender provider design boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Notification sender provider design boundary guard passed.");

import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "docs/56-mobile-real-device-s22-qa-checklist.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required mobile S22 QA file: ${file}`);
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
  checkChecklist();
  checkScriptsAndDocs();
}

function checkChecklist() {
  const file = "docs/56-mobile-real-device-s22-qa-checklist.md";
  const source = read(file);

  for (const token of [
    "# Mobile real-device S22 QA checklist",
    "Samsung Galaxy S22 physical device",
    "Android safe-area and navigation behavior",
    "Bottom tab stays at the physical bottom when Android navigation buttons/gesture bar are hidden.",
    "Bottom tab is pushed above Android navigation buttons/gesture bar when they appear.",
    "OTP/MFA required response is handled on mobile.",
    "Camera image upload works if supported.",
    "Gallery image upload works.",
    "Socket reconnect after app background/foreground does not duplicate messages.",
    "Child-specific notebook/reminder entry point is visible when child data exists.",
    "Notification ops readiness remains draft-only: push sender disabled, n8n workflow disabled, webhook disabled, queue disabled.",
    "Age/development-stage recommendation copy avoids medical, diagnosis, drug, treatment, diet, or therapy claims.",
    "Access token, refresh token, OTP, cookie, password, email, phone, and raw message body do not appear in UI/debug logs.",
    "Release decision: go / no-go"
  ]) {
    mustContain(source, file, token);
  }

  for (const forbidden of [
    "N8N_WEBHOOK_URL=",
    "WEBHOOK_SECRET=",
    "EXPO_ACCESS_TOKEN=",
    "FIREBASE_PRIVATE_KEY=",
    "APNS_KEY=",
    "sk_live_",
    "iyzicoSecret",
    "password: ",
    "otp: "
  ]) {
    mustNotContain(source, file, forbidden);
  }
}

function checkScriptsAndDocs() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const qaScript = scripts["qa:mobile:s22"] ?? "";

  mustContain(qaScript, "package.json#qa:mobile:s22", "node scripts/check-mobile-real-device-s22-qa-boundary.mjs");

  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "mobile real-device s22 qa");
    mustContain(source, file, "pnpm qa:mobile:s22");
    mustContainCaseInsensitive(source, file, "Galaxy S22");
    mustContainCaseInsensitive(source, file, "OTP/MFA");
    mustContainCaseInsensitive(source, file, "bottom tab");
    mustContainCaseInsensitive(source, file, "push sender disabled");
    mustContainCaseInsensitive(source, file, "n8n workflow disabled");
  }
}

if (problems.length > 0) {
  console.error("Mobile real-device S22 QA boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Mobile real-device S22 QA boundary guard passed.");

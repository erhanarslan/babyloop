import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/assistant-safety-guard.service.ts",
  "apps/api/test/assistant-safety-guard.service.test.ts",
  "docs/57-assistant-safety-and-hallucination-guard.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/30-rag-architecture.md",
  "docs/32-assistant-tools.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required assistant safety guard file: ${file}`);
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
  checkDocsAndScripts();
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/assistant-safety-guard.service.ts";
  const testFile = "apps/api/test/assistant-safety-guard.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "evaluateAssistantSafetyGuard",
    "getAssistantSafetyGuardPreview",
    "diagnosisAllowed: false",
    "medicationAdviceAllowed: false",
    "treatmentPlanAllowed: false",
    "dietPrescriptionAllowed: false",
    "therapyClaimAllowed: false",
    "requiresGroundingForSpecificClaims: true",
    "requiresSourceIdsForRag: true",
    "maxUnsupportedSpecificClaims: 0",
    "storeRawChildData: false",
    "storeRawMessageBody: false",
    "exposeEmailPhoneTokenCookieOtp: false",
    "medical_diagnosis",
    "medication_or_dosage",
    "treatment_plan",
    "diet_prescription",
    "therapy_claim",
    "missing_grounding_for_specific_claim"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const forbidden of [
    "diagnosisAllowed: true",
    "medicationAdviceAllowed: true",
    "treatmentPlanAllowed: true",
    "dietPrescriptionAllowed: true",
    "therapyClaimAllowed: true",
    "ragRuntimeEnabled: true",
    "prescribeMedication",
    "diagnoseAndTreat",
    "autonomousMedicalAnswer",
    "console.log"
  ]) {
    mustNotContain(service, serviceFile, forbidden);
  }

  for (const token of [
    "blocks medical diagnosis, medication, and treatment-plan drafts",
    "blocks therapy and diet prescription claims",
    "requires grounding for specific claims and statistics",
    "allows everyday parenting support when it avoids medical and unsupported claims",
    "redacts sensitive values from allowed responses",
    "exposes a guarded preview for release gates",
    "not.toMatch(/antibiyotik başla|5 ml ver|enfeksiyondur/iu"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkDocsAndScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const securityScript = scripts["security:assistant-safety-guard"] ?? "";
  const apiSecurity = scripts["test:api:security"] ?? "";

  mustContain(securityScript, "package.json#security:assistant-safety-guard", "node scripts/check-assistant-safety-guard-boundary.mjs");
  mustContain(apiSecurity, "package.json#test:api:security", "pnpm security:assistant-safety-guard");

  const docs = [
    "docs/57-assistant-safety-and-hallucination-guard.md",
    "docs/25-validation-and-regression-checklist.md",
    "docs/30-rag-architecture.md",
    "docs/32-assistant-tools.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "assistant safety guard");
    mustContain(source, file, "pnpm security:assistant-safety-guard");
    mustContainCaseInsensitive(source, file, "hallucination");
    mustContainCaseInsensitive(source, file, "medical diagnosis");
    mustContainCaseInsensitive(source, file, "medication");
    mustContainCaseInsensitive(source, file, "treatment");
    mustContainCaseInsensitive(source, file, "diet prescription");
    mustContainCaseInsensitive(source, file, "therapy");
    mustContainCaseInsensitive(source, file, "requires grounding");
  }
}

if (problems.length > 0) {
  console.error("Assistant safety guard boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Assistant safety guard boundary passed.");

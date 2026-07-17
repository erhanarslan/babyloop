import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertContains(relativePath, pattern, message) {
  const content = read(relativePath);

  if (!pattern.test(content)) {
    failures.push(`${relativePath} must contain ${message}`);
  }
}

function assertNotContains(relativePath, pattern, message) {
  const content = read(relativePath);

  if (pattern.test(content)) {
    failures.push(`${relativePath} must not contain ${message}`);
  }
}

function assertFile(relativePath) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    failures.push(`${relativePath} must exist`);
  }
}

for (const file of [
  "apps/mobile/src/features/assistant/assistant-api.ts",
  "apps/mobile/src/features/assistant/assistant-display-model.ts",
  "apps/mobile/src/features/assistant/assistant-api.test.ts",
  "apps/mobile/src/features/assistant/assistant-display-model.test.ts",
  "apps/mobile/src/features/sell/ai-listing-draft-api.ts",
  "apps/mobile/src/features/sell/ai-listing-draft-model.ts",
  "apps/mobile/src/features/sell/ai-listing-draft-api.test.ts",
  "apps/mobile/src/features/sell/ai-listing-draft-model.test.ts",
  "apps/backoffice/src/lib/auth-client.test.ts"
]) {
  assertFile(file);
}

assertContains(
  "apps/mobile/src/features/assistant/assistant-api.ts",
  /\/api\/v1\/assistant\/messages/,
  "the real assistant messages endpoint"
);
assertContains(
  "apps/mobile/src/features/assistant/assistant-api.ts",
  /mode[\s\S]*grounded[\s\S]*sources|grounded[\s\S]*mode[\s\S]*sources/,
  "mode, grounded, and sources normalization"
);
assertContains(
  "apps/mobile/src/features/assistant/assistant-api.ts",
  /isSafeMobileAssistantHref[\s\S]*javascript:/,
  "unsafe suggested action href rejection"
);
assertContains(
  "apps/mobile/src/features/assistant/assistant-api.ts",
  /isSafeMobileAssistantHref[\s\S]*data:/,
  "data href rejection"
);
assertContains(
  "apps/mobile/src/features/assistant/assistant-api.ts",
  /isSafeMobileAssistantHref[\s\S]*https\?:/,
  "external http href rejection"
);
assertContains(
  "apps/mobile/src/features/assistant/assistant-display-model.test.ts",
  /not\.toContain\("docs\/rag/,
  "sourcePath hidden from display labels"
);

assertContains(
  "apps/mobile/src/features/sell/ai-listing-draft-api.ts",
  /\/api\/v1\/listings\/ai-draft-suggestions/,
  "the real listings AI draft endpoint"
);
assertContains(
  "apps/mobile/src/features/sell/ai-listing-draft-api.ts",
  /new FormData\(\)[\s\S]*buildMobileListingImageUploadFile[\s\S]*append\("images"/,
  "FormData with existing image normalization"
);
assertNotContains(
  "apps/mobile/src/features/sell/ai-listing-draft-api.ts",
  /content-type["']?\s*:\s*["']multipart|base64|console\.(log|debug|info|warn|error)/iu,
  "manual multipart boundary, raw base64, or logging"
);
assertContains(
  "apps/mobile/src/features/sell/sell-screen.tsx",
  /Boş alanlara uygula[\s\S]*handleApplyAiDraft|handleApplyAiDraft[\s\S]*Boş alanlara uygula/,
  "separate user action before applying AI suggestions"
);
assertContains(
  "apps/mobile/src/features/sell/sell-screen.tsx",
  /warnings[\s\S]*missingDetails|missingDetails[\s\S]*warnings/,
  "warnings and missing details in the UI"
);
assertNotContains(
  "apps/mobile/src/features/sell/sell-screen.tsx",
  /providerName|promptVersion|modelName|handleCreateAiDraft[\s\S]{0,600}createMobileListing|fetchMobileAiListingDraftSuggestion[\s\S]{0,600}handleSubmit/s,
  "provider metadata display or AI auto-submit"
);
assertContains(
  "apps/mobile/src/features/sell/ai-listing-draft-model.test.ts",
  /preserves existing user fields[\s\S]*price[\s\S]*condition|price[\s\S]*condition[\s\S]*preserves existing user fields/,
  "merge test preserving existing title, description, category, price, and condition"
);

assertContains(
  "apps/mobile/src/features/child/child-reminder-date-time-fields.tsx",
  /DateTimePickerAndroid[\s\S]*@react-native-community\/datetimepicker/,
  "DateTimePickerAndroid direct import"
);
assertNotContains(
  "apps/mobile/src/features/child/child-reminder-date-time-fields.tsx",
  /NativeModules\.RNCDatePicker|require\("@react-native-community\/datetimepicker"\)|Yeni build gerekli/,
  "old RNCDatePicker fallback"
);

assertContains(
  "apps/backoffice/src/lib/auth-client.ts",
  /backofficeMePromise[\s\S]*refreshSessionPromise[\s\S]*unauthenticatedCooldownUntil/,
  "shared in-flight and cooldown auth bootstrap state"
);
assertContains(
  "apps/backoffice/src/lib/auth-client.test.ts",
  /deduplicates concurrent me checks[\s\S]*csrf[\s\S]*toBe\(false\)|csrf[\s\S]*toHaveLength\(1\)/,
  "backoffice in-flight/cooldown and refresh-401 no-CSRF tests"
);

const packageJson = JSON.parse(read("package.json"));

if (!packageJson.scripts?.["security:mobile-ai-rag-listing"]?.includes("check-mobile-ai-rag-listing-boundary.mjs")) {
  failures.push("package.json must wire security:mobile-ai-rag-listing");
}

if (!packageJson.scripts?.["release:mobile:p0"]?.includes("security:mobile-ai-rag-listing")) {
  failures.push("release:mobile:p0 must include security:mobile-ai-rag-listing");
}

if (!packageJson.scripts?.["test:mobile:p0"]?.includes("assistant-display-model.test.ts") ||
  !packageJson.scripts?.["test:mobile:p0"]?.includes("ai-listing-draft-api.test.ts")) {
  failures.push("test:mobile:p0 must include assistant and AI listing draft mobile tests");
}

const mobilePackageJson = JSON.parse(read("apps/mobile/package.json"));

if (!mobilePackageJson.scripts?.["test:p0"]?.includes("assistant-display-model.test.ts") ||
  !mobilePackageJson.scripts?.["test:p0"]?.includes("ai-listing-draft-api.test.ts")) {
  failures.push("apps/mobile test:p0 must include assistant and AI listing draft mobile tests");
}

if (failures.length > 0) {
  console.error("Mobile AI/RAG/listing boundary failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Mobile AI/RAG/listing boundary passed.");

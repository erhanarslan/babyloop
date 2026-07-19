import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "apps/api/src/services/listing-image-authenticity.service.ts",
  "apps/api/src/services/listing-image-product-policy.service.ts",
  "apps/api/src/services/listing-image-authenticity-run-audit.service.ts",
  "apps/api/src/routes/listings.routes.ts",
  "apps/api/src/config/env.ts",
  "apps/api/test/listing-image-authenticity.service.test.ts",
  "apps/api/test/listing-image-product-policy.service.test.ts",
  "apps/api/test/listing-image-authenticity.integration.test.ts",
  "apps/api/test/auth-config.test.ts",
  "apps/api/test/admin-ai-ops.schemas.test.ts",
  "apps/api/src/schemas/admin-ai-ops.schemas.ts",
  "apps/backoffice/src/features/ai-ops/api.ts",
  "apps/backoffice/src/features/ai-ops/ai-ops-dashboard.tsx",
  "apps/backoffice/src/features/listings/api.ts",
  "apps/backoffice/src/features/listings/listing-image-review-panel.tsx",
  "packages/database/src/schema/index.ts",
  "packages/database/drizzle/0018_listing_image_ai_authenticity.sql",
  "scripts/check-deployment-readiness.mjs",
  "scripts/run-api-test-bundle.mjs",
  "docs/25-validation-and-regression-checklist.md",
  "docs/30-listing-image-upload-and-safety.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md"
];

const problems = [];

function read(relativePath) {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8");
}

function mustContain(source, file, token) {
  if (!source.includes(token)) {
    problems.push(`${file} must contain ${JSON.stringify(token)}.`);
  }
}

function mustNotContain(source, file, token) {
  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
  }
}

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required listing image authenticity file: ${file}`);
  }
}

if (problems.length === 0) {
  checkProviderBoundary();
  checkUploadRouteBoundary();
  checkAiRunAuditBoundary();
  checkProductionEnvBoundary();
  checkTestCoverageBoundary();
  checkBackofficeSafeVisibilityBoundary();
  checkDatabaseBoundary();
  checkDocsBoundary();
}

function checkProviderBoundary() {
  const file = "apps/api/src/services/listing-image-authenticity.service.ts";
  const source = read(file);

  mustContain(source, file, "ListingImageAuthenticityDecision");
  mustContain(source, file, "allow");
  mustContain(source, file, "reject");
  mustContain(source, file, "LISTING_IMAGE_AUTHENTICITY_PROVIDER");
  mustContain(source, file, "provider === \"mock\"");
  mustContain(source, file, "process.env.NODE_ENV === \"production\"");
  mustContain(source, file, "Mock image authenticity provider cannot run in production.");
  mustContain(source, file, "GEMINI_API_KEY or GOOGLE_API_KEY");
  mustContain(source, file, "gemini-listing-image-authenticity");
  mustContain(source, file, "listing_image_authenticity.gemini.v2");
  mustContain(source, file, "enforceListingImageProductPolicy");
  mustContain(source, file, "PROHIBITED_LISTING_PRODUCT_CODES");
  mustContain(source, file, "normalizeProviderOutput");
  mustContain(source, file, "normalizeDecision");
  mustContain(source, file, "normalizeConfidence");
  mustContain(source, file, "readGeminiTimeoutMs");

  for (const unsafeReturn of [
    "apiKey:",
    "GEMINI_API_KEY:",
    "GOOGLE_API_KEY:",
    "accessToken:",
    "refreshToken:",
    "rawPrompt:"
  ]) {
    mustNotContain(source, file, unsafeReturn);
  }
}

function checkUploadRouteBoundary() {
  const file = "apps/api/src/routes/listings.routes.ts";
  const source = read(file);

  mustContain(source, file, "IMAGE_AUTHENTICITY_REJECTED");
  mustContain(source, file, "IMAGE_AUTHENTICITY_UNAVAILABLE");
  mustContain(source, file, "authenticity");

  for (const unsafe of ["rawPrompt", "rawOutput", "accessToken", "refreshToken", "passwordHash"]) {
    mustNotContain(source, file, unsafe);
  }
}

function checkAiRunAuditBoundary() {
  const file = "apps/api/src/services/listing-image-authenticity-run-audit.service.ts";
  const source = read(file);

  mustContain(source, file, "listing_image_authenticity");
  mustContain(source, file, "aiModelRuns");
  mustContain(source, file, "providerName");
  mustContain(source, file, "modelName");
  mustContain(source, file, "promptVersion");
  mustContain(source, file, "confidenceScore");
  mustContain(source, file, "provider_failed");
  mustContain(source, file, "success");

  for (const unsafe of ["imageBuffer", "base64", "rawPrompt", "rawOutput", "accessToken", "refreshToken", "passwordHash", "GEMINI_API_KEY", "GOOGLE_API_KEY"]) {
    mustNotContain(source, file, unsafe);
  }
}

function checkProductionEnvBoundary() {
  const envFile = "apps/api/src/config/env.ts";
  const readinessFile = "scripts/check-deployment-readiness.mjs";

  const envSource = read(envFile);
  const readinessSource = read(readinessFile);

  for (const [file, source] of [
    [envFile, envSource],
    [readinessFile, readinessSource]
  ]) {
    mustContain(source, file, "LISTING_IMAGE_AUTHENTICITY_PROVIDER");
    mustContain(source, file, "gemini");
    mustContain(source, file, "mock");
    mustContain(source, file, "unavailable");
    mustContain(source, file, "GEMINI_API_KEY");
    mustContain(source, file, "GOOGLE_API_KEY");
  }

  mustContain(envSource, envFile, "LISTING_IMAGE_AUTHENTICITY_PROVIDER=mock cannot be used in production");
  mustContain(envSource, envFile, "LISTING_IMAGE_AUTHENTICITY_PROVIDER=gemini is required in production");
  mustContain(readinessSource, readinessFile, "LISTING_IMAGE_AUTHENTICITY_PROVIDER must be gemini for production.");
  mustContain(readinessSource, readinessFile, "image-authenticity");
}

function checkTestCoverageBoundary() {
  const serviceTestFile = "apps/api/test/listing-image-authenticity.service.test.ts";
  const integrationTestFile = "apps/api/test/listing-image-authenticity.integration.test.ts";
  const authConfigTestFile = "apps/api/test/auth-config.test.ts";
  const adminAiOpsSchemasTestFile = "apps/api/test/admin-ai-ops.schemas.test.ts";
  const apiBundleFile = "scripts/run-api-test-bundle.mjs";

  const serviceTest = read(serviceTestFile);
  const integrationTest = read(integrationTestFile);
  const authConfigTest = read(authConfigTestFile);
  const adminAiOpsTest = read(adminAiOpsSchemasTestFile);
  const apiBundle = read(apiBundleFile);

  mustContain(serviceTest, serviceTestFile, "mock");
  mustContain(serviceTest, serviceTestFile, "gemini");
  mustContain(serviceTest, serviceTestFile, "unavailable");
  mustContain(serviceTest, serviceTestFile, "needs_review");
  mustContain(serviceTest, serviceTestFile, "reject");
  mustContain(serviceTest, serviceTestFile, "GEMINI_LISTING_IMAGE_AUTHENTICITY_MODEL");
  mustContain(serviceTest, serviceTestFile, "GEMINI_API_KEY");

  mustContain(integrationTest, integrationTestFile, "needs_review");
  if (!integrationTest.includes("reject") || !integrationTest.includes("unavailable")) {
    problems.push(`${integrationTestFile} must cover rejected and unavailable provider upload outcomes.`);
  }
  mustContain(integrationTest, integrationTestFile, "listing_image_authenticity");
  mustContain(integrationTest, integrationTestFile, "aiModelRuns");

  mustContain(authConfigTest, authConfigTestFile, "LISTING_IMAGE_AUTHENTICITY_PROVIDER=mock cannot be used in production");
  mustContain(authConfigTest, authConfigTestFile, "LISTING_IMAGE_AUTHENTICITY_PROVIDER=gemini is required in production");
  mustContain(authConfigTest, authConfigTestFile, "GEMINI_API_KEY or GOOGLE_API_KEY is required when LISTING_IMAGE_AUTHENTICITY_PROVIDER=gemini");

  mustContain(adminAiOpsTest, adminAiOpsSchemasTestFile, "rawPrompt");
  mustContain(adminAiOpsTest, adminAiOpsSchemasTestFile, "raw AI payload fields");
  mustContain(adminAiOpsTest, adminAiOpsSchemasTestFile, "accessToken");

  mustContain(apiBundle, apiBundleFile, "test/listing-image-authenticity.integration.test.ts");
}

function checkBackofficeSafeVisibilityBoundary() {
  const aiOpsApiFile = "apps/backoffice/src/features/ai-ops/api.ts";
  const aiOpsDashboardFile = "apps/backoffice/src/features/ai-ops/ai-ops-dashboard.tsx";
  const listingsApiFile = "apps/backoffice/src/features/listings/api.ts";
  const imageReviewPanelFile = "apps/backoffice/src/features/listings/listing-image-review-panel.tsx";
  const adminAiOpsSchemaFile = "apps/api/src/schemas/admin-ai-ops.schemas.ts";

  const aiOpsApi = read(aiOpsApiFile);
  const aiOpsDashboard = read(aiOpsDashboardFile);
  const listingsApi = read(listingsApiFile);
  const imageReviewPanel = read(imageReviewPanelFile);
  const adminAiOpsSchema = read(adminAiOpsSchemaFile);

  mustContain(aiOpsApi, aiOpsApiFile, "listing_image_authenticity");
  mustContain(aiOpsDashboard, aiOpsDashboardFile, "listing_image_authenticity");

  for (const [file, source] of [
    [aiOpsApiFile, aiOpsApi],
    [aiOpsDashboardFile, aiOpsDashboard],
    [listingsApiFile, listingsApi],
    [imageReviewPanelFile, imageReviewPanel],
    [adminAiOpsSchemaFile, adminAiOpsSchema]
  ]) {
    mustNotContain(source, file, "localStorage");
    mustNotContain(source, file, "sessionStorage");
  }

  mustContain(aiOpsDashboard, aiOpsDashboardFile, "without");
  mustContain(aiOpsDashboard, aiOpsDashboardFile, "raw prompts");
  mustContain(aiOpsDashboard, aiOpsDashboardFile, "raw outputs");
  mustContain(aiOpsDashboard, aiOpsDashboardFile, "image payloads");

  mustContain(listingsApi, listingsApiFile, "authenticity");
  mustContain(listingsApi, listingsApiFile, "decision");
  mustContain(listingsApi, listingsApiFile, "confidence");
  mustContain(listingsApi, listingsApiFile, "providerName");
  mustContain(listingsApi, listingsApiFile, "promptVersion");
  mustContain(listingsApi, listingsApiFile, "flags");

  mustContain(imageReviewPanel, imageReviewPanelFile, "SENSITIVE_IMAGE_REVIEW_METADATA_KEY_PARTS");
  mustContain(imageReviewPanel, imageReviewPanelFile, "formatAuthenticityFlags");
  mustContain(imageReviewPanel, imageReviewPanelFile, "sanitizeImageReviewMetadata");
  mustContain(imageReviewPanel, imageReviewPanelFile, "access_token");
  mustContain(imageReviewPanel, imageReviewPanelFile, "refresh_token");
  mustContain(imageReviewPanel, imageReviewPanelFile, "No safe AI flags recorded.");
}

function checkDatabaseBoundary() {
  const schemaFile = "packages/database/src/schema/index.ts";
  const migrationFile = "packages/database/drizzle/0018_listing_image_ai_authenticity.sql";

  const schema = read(schemaFile);
  const migration = read(migrationFile);

  for (const [file, source] of [
    [schemaFile, schema],
    [migrationFile, migration]
  ]) {
      mustContain(source, file, "authenticity_provider");
    mustContain(source, file, "authenticity_model");
    mustContain(source, file, "authenticity_prompt_version");
    mustContain(source, file, "authenticity_decision");
    mustContain(source, file, "authenticity_confidence");
    mustContain(source, file, "authenticity_reasons");
    mustContain(source, file, "authenticity_flags");
    mustContain(source, file, "authenticity_checked_at");
  }
}

function checkDocsBoundary() {
  const checklistFile = "docs/25-validation-and-regression-checklist.md";
  const uploadDocFile = "docs/30-listing-image-upload-and-safety.md";
  const envFile = "docs/54-production-env-checklist.md";
  const smokeFile = "docs/55-beta-critical-smoke-checklist.md";

  const checklist = read(checklistFile);
  const uploadDoc = read(uploadDocFile);
  const env = read(envFile);
  const smoke = read(smokeFile);

  mustContain(checklist, checklistFile, "Listing image authenticity provider boundary");
  mustContain(checklist, checklistFile, "pnpm security:image-authenticity");
  mustContain(checklist, checklistFile, "mock/unavailable must not be accepted for production image authenticity enforcement");
  mustContain(checklist, checklistFile, "raw image bytes, base64, raw prompt, raw provider output, API keys, tokens, cookies, password hashes");

  mustContain(uploadDoc, uploadDocFile, "Listing image authenticity provider boundary");
  mustContain(uploadDoc, uploadDocFile, "LISTING_IMAGE_AUTHENTICITY_PROVIDER=gemini");
  mustContain(uploadDoc, uploadDocFile, "mock provider is local/test only");
  mustContain(uploadDoc, uploadDocFile, "does not store raw image bytes, base64, raw prompts, raw provider output, API keys, tokens, cookies, or password hashes");

  mustContain(env, envFile, "LISTING_IMAGE_AUTHENTICITY_PROVIDER=gemini");
  mustContain(env, envFile, "GEMINI_LISTING_IMAGE_AUTHENTICITY_MODEL");

  mustContain(smoke, smokeFile, "Listing image authenticity provider boundary");
  mustContain(smoke, smokeFile, "AI Ops and listing image review must show safe metadata only");
}

if (problems.length > 0) {
  console.error("Listing image authenticity security guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Listing image authenticity security guard passed.");

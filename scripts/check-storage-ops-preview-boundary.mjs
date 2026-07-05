import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/src/services/admin-storage-ops-preview.service.ts",
  "apps/api/test/admin-storage-ops-preview.service.test.ts",
  "apps/backoffice/src/features/storage/storage-ops-page.tsx",
  "apps/backoffice/src/features/storage/storage-ops-page.test.tsx",
  "docs/25-validation-and-regression-checklist.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required storage ops preview file: ${file}`);
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
  checkBackofficePage();
  checkScriptsAndDocs();
}

function checkServiceAndTests() {
  const serviceFile = "apps/api/src/services/admin-storage-ops-preview.service.ts";
  const testFile = "apps/api/test/admin-storage-ops-preview.service.test.ts";
  const service = read(serviceFile);
  const tests = read(testFile);

  for (const token of [
    "getAdminStorageOpsPreview",
    "assertExternalStorageDisabled",
    "localStorageEnabled: true",
    "externalStorageEnabled: false",
    "storageProviderConfigured: false",
    "signedUploadEnabled: false",
    "queueEnabled: false",
    "imageSafetyRequired: true",
    "moderationQuarantineRequired: true",
    "provider_selection",
    "private_bucket_policy",
    "signed_upload_contract",
    "object_lifecycle_cleanup",
    "migration_replay_plan",
    "no S3/R2 provider call"
  ]) {
    mustContain(service, serviceFile, token);
  }

  for (const forbidden of [
    "S3Client",
    "PutObjectCommand",
    "DeleteObjectCommand",
    "CopyObjectCommand",
    "createPresignedPost",
    "getSignedUrl",
    "AWS_SECRET_ACCESS_KEY",
    "R2_ACCESS_KEY",
    "fetch(",
    "queue.add",
    "console.log"
  ]) {
    mustNotContain(service, serviceFile, forbidden);
  }

  for (const token of [
    "keeps external storage providers disabled",
    "lists requirements before external object storage",
    "exposes a compact external-storage-disabled assertion for release gates",
    "not.toMatch(/AWS_SECRET_ACCESS_KEY_VALUE|S3_BUCKET_NAME_SECRET|R2_ACCESS_KEY_SECRET|signed-url-secret-value|presigned-post-secret-value|delete-object-secret-value|copy-object-secret-value|cdn-purge-secret-value|queue-add-secret-value|fetch-called-secret-value|raw-upload-body-secret-value|gps-location-secret-value/iu"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkBackofficePage() {
  const pageFile = "apps/backoffice/src/features/storage/storage-ops-page.tsx";
  const testFile = "apps/backoffice/src/features/storage/storage-ops-page.test.tsx";
  const page = read(pageFile);
  const tests = read(testFile);

  for (const token of [
    "Storage Ops Preview",
    "External storage provider disabled",
    "S3/R2, signed upload, bucket delete",
    "Required before external storage",
    "Privacy and blocked operations",
    "api/v1/admin/storage/ops-preview"
  ]) {
    mustContain(page, pageFile, token);
  }

  for (const token of [
    "renders local-only storage ops preview without enabling external storage",
    "Storage Ops Preview",
    "External storage provider disabled",
    "S3/R2, signed upload, bucket delete",
    "queue_worker",
    "Storage ops preview failed: 403"
  ]) {
    mustContain(tests, testFile, token);
  }
}

function checkScriptsAndDocs() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  const securityScript = scripts["security:storage-ops-preview"] ?? "";

  mustContain(securityScript, "package.json#security:storage-ops-preview", "node scripts/check-storage-ops-preview-boundary.mjs");

  const docs = [
    "docs/25-validation-and-regression-checklist.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md"
  ];

  for (const file of docs) {
    const source = read(file);
    mustContainCaseInsensitive(source, file, "storage ops preview");
    mustContain(source, file, "pnpm security:storage-ops-preview");
    mustContainCaseInsensitive(source, file, "external storage provider disabled");
    mustContainCaseInsensitive(source, file, "signed upload");
    mustContainCaseInsensitive(source, file, "S3/R2");
    mustContainCaseInsensitive(source, file, "queue worker");
  }
}

if (problems.length > 0) {
  console.error("Storage ops preview boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Storage ops preview boundary guard passed.");

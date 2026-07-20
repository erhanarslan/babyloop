#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  "apps/api/test/listings.integration.test.ts",
  "apps/api/test/listing-image-authenticity.integration.test.ts",
  "apps/api/test/image-storage-s3-contract.test.ts",
  "apps/backoffice/e2e/listing-image-review.smoke.spec.ts",
  "scripts/check-image-upload-review-storage-boundary.mjs",
  "scripts/check-backoffice-image-review-security.mjs",
  "scripts/check-upload-storage-boundary.mjs",
  "scripts/check-image-storage-security.mjs",
  "scripts/check-listing-image-authenticity-security.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "docs/30-listing-image-upload-and-safety.md",
  "docs/36-listing-admin-review-tools.md",
  "docs/37-marketplace-review-operations.md",
  "docs/54-production-env-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md",
  "docs/68-image-upload-review-storage-boundary.md",
  "package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing image upload/review storage boundary file: ${file}`);
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
  checkApiReviewIntegrationBoundary();
  checkAuthenticityAndStorageCoverage();
  checkBackofficeE2eBoundary();
  checkPackageAndBetaSmokeWiring();
  checkDocs();
}

function checkApiReviewIntegrationBoundary() {
  const file = "apps/api/test/listings.integration.test.ts";
  const source = read(file);

  for (const token of [
    "lets the seller upload, serve, and delete a safe listing image",
    "allows admins to reject and approve listing images with public filtering",
    "expectUploadReviewStoragePublicBoundary(upload.body);",
    "expectUploadReviewStoragePublicBoundary(responseBody);",
    "publicDetailAfterReject",
    "publicListAfterReject",
    "adminDetailAfterReject",
    "publicDetailAfterApprove",
    "admin_listing_image_review_applied",
    "reviewStatus: \"rejected\"",
    "reviewStatus: \"approved\"",
    "filePath|objectKey|contentHash|storageDriver|uploadRoot",
    "rawUploadBody|rawProviderOutput|base64",
    "secretAccessKey|accessKeyId|S3_SECRET_ACCESS_KEY|AWS_SECRET_ACCESS_KEY",
    "/Users/",
    "/var/",
    "/tmp/"
  ]) {
    mustContain(source, file, token);
  }
}

function checkAuthenticityAndStorageCoverage() {
  const authenticityFile = "apps/api/test/listing-image-authenticity.integration.test.ts";
  const s3File = "apps/api/test/image-storage-s3-contract.test.ts";
  const authenticity = read(authenticityFile);
  const s3 = read(s3File);

  for (const token of [
    "stores needs_review authenticity metadata, hides the image publicly, and exposes it to admin review",
    "expect(publicDetail).toBeNull()",
    "expect(adminDetail?.images).toHaveLength(1)",
    "rejects provider-rejected images before storage and database insert",
    "fails closed when the authenticity provider is unavailable and does not insert images",
    "serializedAuditInput",
    "not.toContain(\"base64\")",
    "not.toContain(\"description\")"
  ]) {
    mustContain(authenticity, authenticityFile, token);
  }

  for (const token of [
    "without exposing credentials",
    "objectKey",
    "resolveStoredListingImage",
    "../evil.png",
    "expect(JSON.stringify(stored)).not.toContain(\"secret-key-should-not-leak\")",
    "expect(JSON.stringify(stored)).not.toContain(\"access-key-should-not-leak\")"
  ]) {
    mustContain(s3, s3File, token);
  }
}

function checkBackofficeE2eBoundary() {
  const file = "apps/backoffice/e2e/listing-image-review.smoke.spec.ts";
  const source = read(file);

  for (const token of [
    "admin can open review queue, approve a needs-review image, and see audit state",
    "RAW_EMAIL_SENTINEL",
    "RAW_PHONE_SENTINEL",
    "RAW_TOKEN_SENTINEL",
    "RAW_MESSAGE_SENTINEL",
    "RAW_PROMPT_SENTINEL",
    "data-admin-image-review-status",
    "approved",
    "needs_review"
  ]) {
    mustContain(source, file, token);
  }

  for (const forbidden of [
    "secretAccessKey",
    "S3_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "objectKey:",
    "filePath:",
    "rawUploadBody"
  ]) {
    mustNotContain(source, file, forbidden);
  }
}

function checkPackageAndBetaSmokeWiring() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};

  mustContain(
    scripts["security:image-upload-review-storage"] ?? "",
    "package.json#security:image-upload-review-storage",
    "node scripts/check-image-upload-review-storage-boundary.mjs"
  );
  mustContain(
    scripts["test:api:security"] ?? "",
    "package.json#test:api:security",
    "pnpm security:image-upload-review-storage"
  );

  const runner = read("scripts/run-beta-critical-smoke.mjs");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "Image upload/review storage boundary guard");
  mustContain(runner, "scripts/run-beta-critical-smoke.mjs", "security:image-upload-review-storage");
}

function checkDocs() {
  for (const file of [
    "docs/68-image-upload-review-storage-boundary.md",
    "docs/30-listing-image-upload-and-safety.md",
    "docs/36-listing-admin-review-tools.md",
    "docs/37-marketplace-review-operations.md",
    "docs/54-production-env-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ]) {
    const source = read(file);

    mustContainCaseInsensitive(source, file, "image upload/review storage boundary");
    mustContain(source, file, "pnpm security:image-upload-review-storage");
    mustContainCaseInsensitive(source, file, "does not enable S3/R2 rollout");
    mustContainCaseInsensitive(source, file, "does not expose objectKey");
    mustContainCaseInsensitive(source, file, "does not expose filePath");
    mustContainCaseInsensitive(source, file, "does not expose contentHash");
  }
}

if (problems.length > 0) {
  console.error("Image upload/review storage boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Image upload/review storage boundary passed.");

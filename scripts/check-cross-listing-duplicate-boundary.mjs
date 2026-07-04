import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "apps/api/src/services/listings.service.ts",
  "apps/api/src/services/image-storage.service.ts",
  "apps/api/test/listing-image-duplicates.integration.test.ts",
  "packages/database/src/schema/index.ts",
  "packages/database/drizzle/0022_listing_image_content_hash.sql",
  "scripts/check-image-storage-security.mjs",
  "docs/23-architecture-decisions.md",
  "docs/24-stabilization-roadmap.md",
  "docs/25-validation-and-regression-checklist.md",
  "docs/28-listing-lifecycle-and-platform-foundation.md",
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

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required cross-listing duplicate boundary file: ${file}`);
  }
}

if (problems.length === 0) {
  checkDatabaseHashBoundary();
  checkUploadServiceBoundary();
  checkDuplicateTestBoundary();
  checkNoPublicHashExposureBoundary();
  checkDocsBoundary();
}

function checkDatabaseHashBoundary() {
  const schemaFile = "packages/database/src/schema/index.ts";
  const migrationFile = "packages/database/drizzle/0022_listing_image_content_hash.sql";

  const schema = read(schemaFile);
  const migration = read(migrationFile);

  mustContain(schema, schemaFile, "contentHash: text(\"content_hash\")");
  mustContain(schema, schemaFile, "index(\"listing_images_content_hash_idx\").on(table.contentHash)");
  mustContain(schema, schemaFile, "uniqueIndex(\"listing_images_listing_content_hash_unique\").on(table.listingId, table.contentHash)");

  mustContain(migration, migrationFile, "content_hash");
  mustContain(migration, migrationFile, "listing_images_content_hash_idx");
  mustContain(migration, migrationFile, "listing_images_listing_content_hash_unique");
  mustContain(migration, migrationFile, "\"listing_id\",\"content_hash\"");

  for (const forbidden of [
    "listing_images_content_hash_unique",
    "uniqueIndex(\"listing_images_content_hash_unique\")",
    "UNIQUE INDEX IF NOT EXISTS \"listing_images_content_hash_unique\"",
    "UNIQUE (\"content_hash\")"
  ]) {
    mustNotContain(schema, schemaFile, forbidden);
    mustNotContain(migration, migrationFile, forbidden);
  }
}

function checkUploadServiceBoundary() {
  const listingsFile = "apps/api/src/services/listings.service.ts";
  const storageFile = "apps/api/src/services/image-storage.service.ts";

  const listingsSource = read(listingsFile);
  const storageSource = read(storageFile);

  mustContain(storageSource, storageFile, "createListingImageContentHash");
  mustContain(storageSource, storageFile, "contentHash");
  mustContain(storageSource, storageFile, "sha256");

  mustContain(listingsSource, listingsFile, "findListingImageByContentHash");
  mustContain(listingsSource, listingsFile, "duplicate_image");
  mustContain(listingsSource, listingsFile, "storedImage.contentHash");
  mustContain(listingsSource, listingsFile, "eq(listingImages.listingId, listingId)");
  mustContain(listingsSource, listingsFile, "eq(listingImages.contentHash, contentHash)");
  mustContain(listingsSource, listingsFile, "listing_images_listing_content_hash_unique");

  const lookupFunctionStart = listingsSource.indexOf("async function findListingImageByContentHash");
  if (lookupFunctionStart === -1) {
    problems.push(`${listingsFile} must keep findListingImageByContentHash as the same-listing duplicate lookup boundary.`);
  } else {
    const lookupFunction = listingsSource.slice(
      lookupFunctionStart,
      Math.min(listingsSource.length, lookupFunctionStart + 900)
    );
    mustContain(lookupFunction, `${listingsFile}#findListingImageByContentHash`, "listingId");
    mustContain(lookupFunction, `${listingsFile}#findListingImageByContentHash`, "contentHash");
    mustContain(lookupFunction, `${listingsFile}#findListingImageByContentHash`, "eq(listingImages.listingId, listingId)");
    mustContain(lookupFunction, `${listingsFile}#findListingImageByContentHash`, "eq(listingImages.contentHash, contentHash)");
  }

  for (const forbidden of [
    "CROSS_LISTING_DUPLICATE_IMAGE",
    "DUPLICATE_IMAGE_ACROSS_LISTINGS",
    "crossListingDuplicate",
    "findAnyListingImageByContentHash",
    "findListingImagesByContentHashAcrossListings"
  ]) {
    mustNotContain(listingsSource, listingsFile, forbidden);
  }
}

function checkDuplicateTestBoundary() {
  const testFile = "apps/api/test/listing-image-duplicates.integration.test.ts";
  const testSource = read(testFile);

  mustContain(testSource, testFile, "rejects uploading the same image content twice for the same listing without exposing hashes");
  mustContain(testSource, testFile, "DUPLICATE_LISTING_IMAGE");
  mustContain(testSource, testFile, "contentHash");
  mustContain(testSource, testFile, "content_hash");
  mustContain(testSource, testFile, "sha256");
  mustContain(testSource, testFile, "not.toMatch");

  const securityScript = read("scripts/check-image-storage-security.mjs");
  mustContain(securityScript, "scripts/check-image-storage-security.mjs", "listing_image_content_hash");
  mustContain(securityScript, "scripts/check-image-storage-security.mjs", "listing_images_listing_content_hash_unique");
}

function checkNoPublicHashExposureBoundary() {
  const files = [
    "apps/api/src/services/listing-response.mapper.ts",
    "apps/api/src/services/admin-listings.service.ts",
    "apps/backoffice/src/features/listings/api.ts",
    "apps/backoffice/src/features/listings/listing-image-review-panel.tsx",
    "apps/backoffice/src/features/listings/listing-admin-detail.tsx",
    "apps/backoffice/src/features/listings/listing-admin-list.tsx"
  ];

  for (const file of files) {
    if (!existsSync(`${process.cwd()}/${file}`)) {
      problems.push(`Missing hash exposure boundary file: ${file}`);
      continue;
    }

    const source = read(file);
    for (const forbidden of ["contentHash", "content_hash", "sha256"]) {
      mustNotContain(source, file, forbidden);
    }
  }
}

function checkDocsBoundary() {
  const archFile = "docs/23-architecture-decisions.md";
  const roadmapFile = "docs/24-stabilization-roadmap.md";
  const lifecycleFile = "docs/28-listing-lifecycle-and-platform-foundation.md";
  const uploadDocFile = "docs/30-listing-image-upload-and-safety.md";
  const checklistFile = "docs/25-validation-and-regression-checklist.md";
  const envFile = "docs/54-production-env-checklist.md";
  const smokeFile = "docs/55-beta-critical-smoke-checklist.md";

  const arch = read(archFile);
  const roadmap = read(roadmapFile);
  const lifecycle = read(lifecycleFile);
  const uploadDoc = read(uploadDocFile);
  const checklist = read(checklistFile);
  const env = read(envFile);
  const smoke = read(smokeFile);

  mustContain(uploadDoc, uploadDocFile, "cross-listing duplicates should be treated later as a fraud/risk signal rather than a hard block");
  mustContain(uploadDoc, uploadDocFile, "content hashes are internal metadata and must not be exposed in public, owner, or admin DTOs");
  mustContain(uploadDoc, uploadDocFile, "Cross-listing duplicate image boundary");
  mustContain(uploadDoc, uploadDocFile, "seller context");
  mustContain(uploadDoc, uploadDocFile, "time window");
  mustContain(uploadDoc, uploadDocFile, "perceptual hash");
  mustContain(uploadDoc, uploadDocFile, "appeal");

  mustContain(checklist, checklistFile, "Cross-listing duplicate image boundary");
  mustContain(checklist, checklistFile, "same listing");
  mustContain(checklist, checklistFile, "hard-blocked across listings");
  mustContainCaseInsensitive(checklist, checklistFile, "content hashes remain internal");

  mustContain(smoke, smokeFile, "Cross-listing duplicate image boundary");
  mustContain(smoke, smokeFile, "same listing duplicate image upload");
  mustContainCaseInsensitive(smoke, smokeFile, "cross-listing duplicate image use is not claimed as production fraud detection");

  for (const [file, source] of [
    [archFile, arch],
    [roadmapFile, roadmap],
    [lifecycleFile, lifecycle],
    [envFile, env]
  ]) {
    mustContain(source, file, "cross-listing");
    mustContain(source, file, "fraud");
  }
}

if (problems.length > 0) {
  console.error("Cross-listing duplicate image boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Cross-listing duplicate image boundary guard passed.");

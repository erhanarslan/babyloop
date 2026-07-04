import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "apps/api/src/app.ts",
  "apps/api/src/routes/listings.routes.ts",
  "apps/api/src/routes/uploads.routes.ts",
  "apps/api/src/services/image-safety.service.ts",
  "apps/api/src/services/image-storage.service.ts",
  "apps/api/test/listings.integration.test.ts",
  "apps/api/test/image-storage.service.test.ts",
  "apps/api/test/image-storage-s3-contract.test.ts",
  "docs/23-architecture-decisions.md",
  "docs/24-stabilization-roadmap.md",
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

function mustNotContain(source, file, token) {
  if (source.includes(token)) {
    problems.push(`${file} must not contain stale/unsafe wording ${JSON.stringify(token)}.`);
  }
}

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing required upload/storage boundary file: ${file}`);
  }
}

if (problems.length === 0) {
  checkAppBoundary();
  checkListingUploadBoundary();
  checkStaticUploadCacheBoundary();
  checkStoragePublicMediaBoundary();
  checkRegressionCoverage();
  checkDocsBoundary();
}

function checkAppBoundary() {
  const file = "apps/api/src/app.ts";
  const source = read(file);

  mustContain(source, file, "@fastify/rate-limit");
  mustContain(source, file, "app.register(rateLimit");
  mustContain(source, file, "@fastify/multipart");
  mustContain(source, file, "app.register(multipart");
  mustContain(source, file, "MAX_LISTING_IMAGE_BYTES");
  mustContain(source, file, "MAX_LISTING_IMAGES");
  mustContain(source, file, "fileSize");
  mustContain(source, file, "files");

  if (!source.includes("statusCode === 429") && !source.includes("RATE_LIMITED")) {
    problems.push(`${file} should map 429 responses to the safe RATE_LIMITED API error boundary.`);
  }
}

function checkListingUploadBoundary() {
  const routeFile = "apps/api/src/routes/listings.routes.ts";
  const safetyFile = "apps/api/src/services/image-safety.service.ts";
  const routeSource = read(routeFile);
  const safetySource = read(safetyFile);

  mustContain(routeSource, routeFile, "request.file");
  mustContain(routeSource, routeFile, "fileSize: MAX_LISTING_IMAGE_BYTES");
  mustContain(routeSource, routeFile, "validateListingImage");
  mustContain(routeSource, routeFile, "IMAGE_TOO_LARGE");
  mustContain(routeSource, routeFile, "MAX_LISTING_IMAGES");
  if (!routeSource.includes("MAX_LISTING_IMAGES") || !routeSource.includes("images.length >= MAX_LISTING_IMAGES")) {
    problems.push(`${routeFile} must reject extra listing images before storage.`);
  }

  mustContain(safetySource, safetyFile, "MAX_LISTING_IMAGE_BYTES");
  mustContain(safetySource, safetyFile, "MAX_LISTING_IMAGES");
  mustContain(safetySource, safetyFile, "IMAGE_TOO_LARGE");
  mustContain(safetySource, safetyFile, "INVALID_IMAGE");
  mustContain(safetySource, safetyFile, "detectImageMime");
  mustContain(safetySource, safetyFile, "magicMime");

  if (!routeSource.includes("413") || !routeSource.includes("400")) {
    problems.push(`${routeFile} should preserve safe client errors for oversized and invalid image uploads.`);
  }
}

function checkStaticUploadCacheBoundary() {
  const file = "apps/api/src/routes/uploads.routes.ts";
  const source = read(file);

  mustContain(source, file, "Cache-Control");
  mustContain(source, file, "public, max-age=31536000, immutable");

  for (const token of ["..", "pathTraversal", "secretAccessKey", "S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]) {
    if (token === "..") {
      // Literal '..' may be used in safe path checks; do not fail on it.
      continue;
    }

    mustNotContain(source, file, token);
  }
}

function checkStoragePublicMediaBoundary() {
  const file = "apps/api/src/services/image-storage.service.ts";
  const source = read(file);

  mustContain(source, file, "IMAGE_STORAGE_PUBLIC_BASE_URL");
  mustContain(source, file, "assertPublicBaseUrl");
  mustContain(source, file, "resolveS3ObjectKeyFromPublicUrl");
  mustContain(source, file, "IMAGE_PROXY_MEMORY_CACHE_ENABLED");
  mustContain(source, file, "IMAGE_PROXY_MEMORY_CACHE_MAX_BYTES");
  mustContain(source, file, "IMAGE_PROXY_MEMORY_CACHE_MAX_ITEM_BYTES");
  mustContain(source, file, "buildImageProxyCacheKey");
  mustContain(source, file, "getImageProxyCacheEntry");
  mustContain(source, file, "setImageProxyCacheEntry");
  mustContain(source, file, "deleteImageProxyCacheEntry");

  if (!source.includes("new URL") && !source.includes("protocol") && !source.includes("assertPublicBaseUrl")) {
    problems.push(`${file} should validate public media URLs explicitly.`);
  }

  for (const token of ["console.log", "console.info", "console.warn", "console.error"]) {
    if (source.includes(token) && /secretAccessKey|S3_SECRET_ACCESS_KEY|AWS_SECRET_ACCESS_KEY|accessKeyId/u.test(source)) {
      problems.push(`${file} must not log storage credentials.`);
    }
  }
}

function checkRegressionCoverage() {
  const listingsTestFile = "apps/api/test/listings.integration.test.ts";
  const storageTestFile = "apps/api/test/image-storage.service.test.ts";
  const s3ContractFile = "apps/api/test/image-storage-s3-contract.test.ts";

  const listingsTestSource = read(listingsTestFile);
  const storageTestSource = read(storageTestFile);
  const s3ContractSource = read(s3ContractFile);

  mustContain(listingsTestSource, listingsTestFile, "IMAGE_TOO_LARGE");
  mustContain(listingsTestSource, listingsTestFile, "enforces listing image count");
  mustContain(listingsTestSource, listingsTestFile, "sixthRequest");
  if (!listingsTestSource.includes("htmlDisguisedRequest") && !listingsTestSource.includes("mismatchRequest")) {
    problems.push(`${listingsTestFile} must cover disguised/invalid image upload rejection.`);
  }

  mustContain(storageTestSource, storageTestFile, "IMAGE_STORAGE_PUBLIC_BASE_URL");
  mustContain(storageTestSource, storageTestFile, "https://cdn.example.test");

  mustContain(s3ContractSource, s3ContractFile, "without exposing credentials");
  mustContain(s3ContractSource, s3ContractFile, "resolve");
  if (!s3ContractSource.includes("attacker") && !s3ContractSource.includes("unsafe") && !s3ContractSource.includes("object key")) {
    problems.push(`${s3ContractFile} must cover attacker-controlled/unsafe object-key boundaries.`);
  }
}

function checkDocsBoundary() {
  const archFile = "docs/23-architecture-decisions.md";
  const roadmapFile = "docs/24-stabilization-roadmap.md";
  const lifecycleFile = "docs/28-listing-lifecycle-and-platform-foundation.md";
  const uploadDocFile = "docs/30-listing-image-upload-and-safety.md";
  const envFile = "docs/54-production-env-checklist.md";
  const smokeFile = "docs/55-beta-critical-smoke-checklist.md";

  const arch = read(archFile);
  const roadmap = read(roadmapFile);
  const lifecycle = read(lifecycleFile);
  const uploadDoc = read(uploadDocFile);
  const env = read(envFile);
  const smoke = read(smokeFile);

  for (const [file, source] of [
    [archFile, arch],
    [roadmapFile, roadmap],
    [lifecycleFile, lifecycle],
    [uploadDocFile, uploadDoc],
    [envFile, env],
    [smokeFile, smoke]
  ]) {
    mustContain(source, file, "upload");
    mustContain(source, file, "storage");
  }

  mustContain(uploadDoc, uploadDocFile, "Upload abuse and public media cache boundary");
  mustContain(uploadDoc, uploadDocFile, "global API rate limiting");
  mustContain(uploadDoc, uploadDocFile, "multipart");
  mustContain(uploadDoc, uploadDocFile, "MAX_LISTING_IMAGE_BYTES");
  mustContain(uploadDoc, uploadDocFile, "MAX_LISTING_IMAGES");
  mustContain(uploadDoc, uploadDocFile, "Cache-Control: public, max-age=31536000, immutable");
  mustContain(uploadDoc, uploadDocFile, "Dedicated per-profile/per-IP upload frequency quotas remain future work");

  mustContain(env, envFile, "Rate limits must cover auth, messaging, upload, assistant, and admin-sensitive routes.");
  mustContain(env, envFile, "IMAGE_PROXY_MEMORY_CACHE_ENABLED");

  mustContain(smoke, smokeFile, "Rate limits are active on high-risk endpoints or explicitly tracked as a beta blocker.");
  mustContain(smoke, smokeFile, "Upload abuse and public media cache boundary");

  for (const stale of [
    "CDN/cache policy, upload rate limits, and image moderation are intentionally deferred",
    "CDN/cache strategy, upload rate limits, and image moderation are not implemented yet",
    "CDN/cache validation, upload rate-limit review"
  ]) {
    for (const [file, source] of [
      [archFile, arch],
      [roadmapFile, roadmap],
      [lifecycleFile, lifecycle],
      [uploadDocFile, uploadDoc],
      [envFile, env]
    ]) {
      mustNotContain(source, file, stale);
    }
  }
}

if (problems.length > 0) {
  console.error("Upload/storage boundary guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Upload/storage boundary guard passed.");

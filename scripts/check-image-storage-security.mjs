#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const problems = [];

const requiredFiles = [
  "apps/api/src/services/image-storage.service.ts",
  "apps/api/src/services/image-safety.service.ts",
  "apps/api/src/services/image-optimization.service.ts",
  "apps/api/src/services/admin-storage-ops.service.ts",
  "scripts/check-deployment-readiness.mjs",
  "docs/54-production-env-checklist.md"
];

for (const file of requiredFiles) {
  if (!existsSync(path.join(root, file))) {
    problems.push(`Missing required storage/security file: ${file}`);
  }
}

checkImageStorageService();
checkImageSafetyService();
checkImageOptimizationService();
checkDeploymentReadiness();
checkAdminStorageOps();
checkStorageDocs();
checkSensitiveStorageLogSinks();
checkStaleFutureStorageDocs();

if (problems.length > 0) {
  console.error("Image storage security guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Image storage security guard passed.");

function checkImageStorageService() {
  const file = "apps/api/src/services/image-storage.service.ts";
  const source = read(file);

  if (!source) return;

  mustContain(source, file, "IMAGE_STORAGE_DRIVER must be local or s3.");
  mustContain(source, file, "IMAGE_STORAGE_PUBLIC_BASE_URL");
  mustContain(source, file, "S3_BUCKET");
  mustContain(source, file, "S3_ACCESS_KEY_ID");
  mustContain(source, file, "S3_SECRET_ACCESS_KEY");
  mustContain(source, file, "PutObjectCommand");
  mustContain(source, file, "GetObjectCommand");
  mustContain(source, file, "DeleteObjectCommand");
  mustContain(source, file, "resolveS3ObjectKeyFromPublicUrl");
  mustContain(source, file, "assertPublicBaseUrl");
  mustContain(source, file, "IMAGE_PROXY_MEMORY_CACHE_ENABLED");

  if (/console\.(?:log|debug|info|warn|error).*S3_SECRET_ACCESS_KEY/u.test(source)) {
    problems.push(`${file} must not log S3_SECRET_ACCESS_KEY.`);
  }
}

function checkImageSafetyService() {
  const file = "apps/api/src/services/image-safety.service.ts";
  const source = read(file);

  if (!source) return;

  mustContain(source, file, "MAX_LISTING_IMAGE_BYTES");
  mustContain(source, file, "MAX_LISTING_IMAGES");
  mustContain(source, file, "INVALID_IMAGE");
  mustContain(source, file, "IMAGE_TOO_LARGE");

  for (const token of ["image/png", "image/jpeg", "image/webp"]) {
    mustContain(source, file, token);
  }
}

function checkImageOptimizationService() {
  const file = "apps/api/src/services/image-optimization.service.ts";
  const source = read(file);

  if (!source) return;

  mustContain(source, file, "IMAGE_OPTIMIZATION_ENABLED");
  mustContain(source, file, "LISTING_IMAGE_MAX_DIMENSION");
  mustContain(source, file, "LISTING_IMAGE_JPEG_QUALITY");
  mustContain(source, file, "sharp");

  if (!/\.rotate\(\)|\.jpeg\(/u.test(source)) {
    problems.push(`${file} should normalize orientation and encode optimized JPEG output.`);
  }
}

function checkDeploymentReadiness() {
  const file = "scripts/check-deployment-readiness.mjs";
  const source = read(file);

  if (!source) return;

  mustContain(source, file, "IMAGE_STORAGE_DRIVER=local is not acceptable for production user uploads.");
  mustContain(source, file, "IMAGE_STORAGE_PUBLIC_BASE_URL");
  mustContain(source, file, "S3_BUCKET");
  mustContain(source, file, "S3_REGION");
  mustContain(source, file, "S3_ACCESS_KEY_ID");
  mustContain(source, file, "S3_SECRET_ACCESS_KEY");
  mustContain(source, file, "requireHttpsUrlEnv");
}

function checkAdminStorageOps() {
  const file = "apps/api/src/services/admin-storage-ops.service.ts";
  const source = read(file);

  if (!source) return;

  mustContain(source, file, "Local driver");
  mustContain(source, file, "S3/R2");
  mustContain(source, file, "absolute public URL");

  for (const forbidden of ["secretAccessKey", "S3_SECRET_ACCESS_KEY", "accessKeyId"]) {
    if (source.includes(forbidden)) {
      problems.push(`${file} should not expose ${forbidden} in storage ops preview.`);
    }
  }
}

function checkStorageDocs() {
  const file = "docs/54-production-env-checklist.md";
  const source = read(file);

  if (!source) return;

  mustContain(source, file, "IMAGE_STORAGE_DRIVER=local|s3");
  mustContain(source, file, "IMAGE_STORAGE_PUBLIC_BASE_URL");
  mustContain(source, file, "S3_BUCKET");
  mustContain(source, file, "S3_SECRET_ACCESS_KEY");
  mustContain(source, file, "Production must not rely on ephemeral container disk");
  mustContain(source, file, "IMAGE_OPTIMIZATION_ENABLED");
  mustContain(source, file, "IMAGE_PROXY_MEMORY_CACHE_ENABLED");
}

function checkSensitiveStorageLogSinks() {
  const roots = ["apps/api/src", "apps/backoffice/src", "apps/web/src", "apps/mobile", "packages"];
  const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
  const logSinkPattern = /\b(?:console\.(?:log|debug|info|warn|error)|request\.log\.(?:trace|debug|info|warn|error|fatal)|app\.log\.(?:trace|debug|info|warn|error|fatal))\b/u;
  const sensitiveStoragePattern = /\b(?:S3_SECRET_ACCESS_KEY|AWS_SECRET_ACCESS_KEY|secretAccessKey|S3_ACCESS_KEY_ID|accessKeyId|RESEND_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY)\b/u;

  for (const rootDir of roots) {
    const absoluteRoot = path.join(root, rootDir);

    if (!existsSync(absoluteRoot)) continue;

    for (const filePath of walk(absoluteRoot)) {
      const normalized = toRelative(filePath);

      if (!codeExtensions.has(path.extname(filePath))) continue;

      const lines = readFileSync(filePath, "utf8").split("\n");

      lines.forEach((line, index) => {
        if (logSinkPattern.test(line) && sensitiveStoragePattern.test(line)) {
          problems.push(`Possible storage secret log sink at ${normalized}:${index + 1}`);
        }
      });
    }
  }
}

function checkStaleFutureStorageDocs() {
  const staleDocs = [
    "docs/30-listing-image-upload-and-safety.md",
    "docs/23-architecture-decisions.md",
    "docs/24-stabilization-roadmap.md",
    "docs/28-listing-lifecycle-and-platform-foundation.md"
  ];

  const stalePatterns = [
    /Future R2\/S3 Migration/u,
    /Future work can replace local storage with R2\/S3-compatible storage/u,
    /Production storage still needs an S3\/R2-compatible provider/u,
    /R2\/S3 image storage integration/u
  ];

  for (const file of staleDocs) {
    const source = read(file);

    if (!source) continue;

    for (const pattern of stalePatterns) {
      if (pattern.test(source)) {
        problems.push(`${file} contains stale future-storage wording: ${pattern}`);
      }
    }
  }
}

function mustContain(source, file, token) {
  if (!source.includes(token)) {
    problems.push(`${file} must contain: ${token}`);
  }
}

function read(file) {
  const fullPath = path.join(root, file);

  if (!existsSync(fullPath)) {
    return null;
  }

  return readFileSync(fullPath, "utf8");
}

function* walk(directory) {
  let entries;

  try {
    entries = readdirSync(directory);
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry);

    if (isIgnoredPath(toRelative(absolutePath))) continue;

    let stats;

    try {
      stats = statSync(absolutePath);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      yield* walk(absolutePath);
      continue;
    }

    if (stats.isFile()) {
      yield absolutePath;
    }
  }
}

function toRelative(absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function isIgnoredPath(relativePath) {
  return (
    relativePath === "" ||
    relativePath.startsWith(".git/") ||
    relativePath.includes("/node_modules/") ||
    relativePath.includes("/.next/") ||
    relativePath.includes("/dist/") ||
    relativePath.includes("/coverage/") ||
    relativePath.includes("/.turbo/") ||
    relativePath.includes("/playwright-report/") ||
    relativePath.includes("/test-results/")
  );
}

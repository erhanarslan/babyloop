#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const problems = [];

const artifactPatterns = [
  /^\.env(?:\..*)?\.backup.*$/u,
  /^.*\.backup(?:[-.].*)?$/u,
  /^.*\.backup.*$/u,
  /^.*\.secret(?:[-.].*)?$/u,
  /^.*\.secret.*$/u,
  /^.*\.bak(?:[-.].*)?$/u,
  /^.*\.bak.*$/u,
  /^babyloop-.*\.txt$/u,
  /^babyloop-.*\.zip$/u
];

const codeRoots = [
  "apps/api/src",
  "apps/web/src",
  "apps/backoffice/src",
  "apps/mobile",
  "packages"
];

const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const logSinkPattern =
  /\b(?:console\.(?:log|debug|info|warn|error)|request\.log\.(?:trace|debug|info|warn|error|fatal)|app\.log\.(?:trace|debug|info|warn|error|fatal))\b/u;

const sensitiveLogPattern =
  /\b(?:accessToken|refreshToken|refreshTokenHash|passwordHash|password_hash|resetToken|verificationToken|emailVerificationToken|devResetToken|devEmailVerificationToken|devOtpCode|otpCode|clientSecret|GOOGLE_CLIENT_SECRET|SMTP_PASS|RESEND_API_KEY|authorization|set-cookie|cookie)\b/u;

checkGeneratedOrSecretArtifacts();
checkAuthDevTokenGuards();
checkSensitiveLogSinks();

if (problems.length > 0) {
  console.error("Auth secret/token leak guard failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Auth secret/token leak guard passed.");

function checkGeneratedOrSecretArtifacts() {
  for (const filePath of walk(root)) {
    const normalized = toRelative(filePath);
    const basename = path.basename(normalized);

    if (isIgnoredPath(normalized)) continue;

    if (artifactPatterns.some((pattern) => pattern.test(basename))) {
      problems.push(`Remove generated/secret artifact: ${normalized}`);
    }
  }
}

function checkAuthDevTokenGuards() {
  const authRoutesPath = path.join(root, "apps/api/src/routes/auth.routes.ts");

  if (!existsSync(authRoutesPath)) {
    problems.push("Missing apps/api/src/routes/auth.routes.ts");
    return;
  }

  const source = readFileSync(authRoutesPath, "utf8");

  for (const helper of [
    "shouldExposeDevAuthToken",
    "shouldExposeDevEmailVerificationToken",
    "shouldExposeDevResetToken",
    "shouldExposeDevOtpCode"
  ]) {
    const count = countFunctionDeclarations(source, helper);

    if (count !== 1) {
      problems.push(`Expected exactly one ${helper} function, found ${count}.`);
    }
  }

  const mainHelper = extractFunctionBody(source, "shouldExposeDevAuthToken");

  if (!mainHelper) return;

  if (!mainHelper.includes('process.env.NODE_ENV === "test"')) {
    problems.push("shouldExposeDevAuthToken must allow automatic exposure only in NODE_ENV=test.");
  }

  if (!mainHelper.includes('process.env.NODE_ENV === "production"')) {
    problems.push("shouldExposeDevAuthToken must explicitly block NODE_ENV=production.");
  }

  if (!mainHelper.includes("return false")) {
    problems.push("shouldExposeDevAuthToken must return false for production.");
  }

  if (!mainHelper.includes("BABYLOOP_EXPOSE_DEV_AUTH_TOKENS")) {
    problems.push("shouldExposeDevAuthToken must require BABYLOOP_EXPOSE_DEV_AUTH_TOKENS outside tests.");
  }

  for (const helper of [
    "shouldExposeDevEmailVerificationToken",
    "shouldExposeDevResetToken",
    "shouldExposeDevOtpCode"
  ]) {
    const body = extractFunctionBody(source, helper);

    if (!body) continue;

    if (!body.includes("shouldExposeDevAuthToken()")) {
      problems.push(`${helper} must delegate to shouldExposeDevAuthToken().`);
    }
  }
}

function checkSensitiveLogSinks() {
  for (const rootDir of codeRoots) {
    const absoluteRoot = path.join(root, rootDir);
    if (!existsSync(absoluteRoot)) continue;

    for (const filePath of walk(absoluteRoot)) {
      const normalized = toRelative(filePath);
      if (isIgnoredPath(normalized)) continue;
      if (!codeExtensions.has(path.extname(filePath))) continue;

      const lines = readFileSync(filePath, "utf8").split("\n");

      lines.forEach((line, index) => {
        if (!logSinkPattern.test(line)) return;
        if (!sensitiveLogPattern.test(line)) return;

        problems.push(`Possible sensitive log sink at ${normalized}:${index + 1}`);
      });
    }
  }
}

function countFunctionDeclarations(source, name) {
  return [...source.matchAll(new RegExp(`function\\s+${name}\\s*\\(`, "gu"))].length;
}

function extractFunctionBody(source, name) {
  const start = source.search(new RegExp(`function\\s+${name}\\s*\\(`, "u"));
  if (start < 0) return null;

  const openBrace = source.indexOf("{", start);
  if (openBrace < 0) return null;

  let depth = 0;

  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") depth += 1;

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(openBrace + 1, index);
      }
    }
  }

  return null;
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
    const normalized = toRelative(absolutePath);

    if (isIgnoredPath(normalized)) continue;

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
    relativePath === ".git" ||
    relativePath.startsWith(".git/") ||
    relativePath === "node_modules" ||
    relativePath.includes("/node_modules/") ||
    relativePath === ".next" ||
    relativePath.includes("/.next/") ||
    relativePath === "dist" ||
    relativePath.includes("/dist/") ||
    relativePath === "coverage" ||
    relativePath.includes("/coverage/") ||
    relativePath === ".turbo" ||
    relativePath.includes("/.turbo/") ||
    relativePath === ".e2e-results" ||
    relativePath.includes("/.e2e-results/") ||
    relativePath.includes("/playwright-report/") ||
    relativePath.includes("/test-results/")
  );
}

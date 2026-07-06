#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const problems = [];

const requiredFiles = [
  ".github/workflows/ci.yml",
  "package.json",
  "scripts/check-ci-mobile-p0-parity-boundary.mjs",
  "scripts/check-mobile-p0-release-gate.mjs",
  "docs/25-validation-and-regression-checklist.md",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing CI Mobile P0 parity file: ${file}`);
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
  checkWorkflow();
  checkPackageScripts();
  checkDocs();
}

function checkWorkflow() {
  const file = ".github/workflows/ci.yml";
  const source = read(file);
  const mobileJob = getYamlJobBlock(source, "mobile-p0");

  for (const token of [
    "mobile-p0:",
    "name: Mobile P0 release gate",
    "runs-on: ubuntu-latest",
    "pnpm install --frozen-lockfile",
    "pnpm release:artifacts",
    "pnpm security:ci-mobile-p0-parity",
    "pnpm security:mobile-p0-gate",
    "pnpm release:mobile:p0"
  ]) {
    mustContain(source, file, token);
  }

  for (const forbidden of [
    "postgres:",
    "TEST_DATABASE_URL:",
    "services:",
    "maestro",
    "test:e2e:mobile",
    "RUN_MOBILE_E2E",
    "expo start",
    "adb"
  ]) {
    mustNotContain(mobileJob, `${file}#jobs.mobile-p0`, forbidden);
  }
}

function checkPackageScripts() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};

  mustContain(
    scripts["security:ci-mobile-p0-parity"] ?? "",
    "package.json#security:ci-mobile-p0-parity",
    "node scripts/check-ci-mobile-p0-parity-boundary.mjs"
  );

  const mobileGate = scripts["release:mobile:p0"] ?? "";
  mustContain(mobileGate, "package.json#release:mobile:p0", "pnpm security:mobile-auth");
  mustContain(mobileGate, "package.json#release:mobile:p0", "pnpm security:mobile-notifications");
  mustContain(mobileGate, "package.json#release:mobile:p0", "pnpm test:mobile:p0");
  mustContain(mobileGate, "package.json#release:mobile:p0", "pnpm --filter @babyloop/mobile typecheck");

  for (const forbidden of [
    "maestro",
    "test:e2e:mobile",
    "RUN_MOBILE_E2E",
    "expo start",
    "adb"
  ]) {
    mustNotContain(mobileGate, "package.json#release:mobile:p0", forbidden);
  }
}

function checkDocs() {
  for (const file of [
    "docs/25-validation-and-regression-checklist.md",
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ]) {
    const source = read(file);

    mustContainCaseInsensitive(source, file, "CI Mobile P0 parity");
    mustContain(source, file, "pnpm security:ci-mobile-p0-parity");
    mustContain(source, file, "pnpm release:mobile:p0");
    mustContainCaseInsensitive(source, file, "does not run Maestro");
    mustContainCaseInsensitive(source, file, "does not require ADB");
  }
}

function getYamlJobBlock(source, jobName) {
  const startToken = `  ${jobName}:`;
  const startIndex = source.indexOf(startToken);

  if (startIndex === -1) {
    return "";
  }

  const afterStart = source.slice(startIndex + startToken.length);
  const nextJobMatch = /\n  [A-Za-z0-9_-]+:/u.exec(afterStart);

  if (!nextJobMatch) {
    return source.slice(startIndex);
  }

  return source.slice(startIndex, startIndex + startToken.length + nextJobMatch.index);
}

if (problems.length > 0) {
  console.error("CI Mobile P0 parity boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("CI Mobile P0 parity boundary passed.");

#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const problems = [];
const requiredFiles = [
  "scripts/check-release-artifacts.mjs",
  "scripts/clean-release-artifacts.mjs",
  "scripts/run-beta-critical-smoke.mjs",
  "package.json",
  "docs/55-beta-critical-smoke-checklist.md",
  "docs/58-beta-critical-smoke-automation.md"
];

for (const file of requiredFiles) {
  if (!existsSync(`${process.cwd()}/${file}`)) {
    problems.push(`Missing release artifact guard UX file: ${file}`);
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

function mustNotContain(source, file, token) {
  if (source.includes(token)) {
    problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
  }
}

if (problems.length === 0) {
  checkGuardUx();
  checkCleanerUx();
  checkWiringAndDocs();
}

function checkGuardUx() {
  const file = "scripts/check-release-artifacts.mjs";
  const source = read(file);

  for (const token of [
    "Tracked generated artifacts (must be removed from git with git rm):",
    "Untracked generated artifacts (usually cleanable with pnpm release:clean):",
    "Filesystem generated artifact paths (usually cleanable with pnpm release:clean):",
    "Recommended cleanup:",
    "git rm --",
    "Bypass is not recommended for release/beta flows.",
    "Reviewed diagnostic-only bypass",
    "ALLOW_RELEASE_ARTIFACTS=1 pnpm release:artifacts",
    "readUntrackedGitPaths",
    "trackedArtifacts",
    "untrackedArtifacts"
  ]) {
    mustContain(source, file, token);
  }

  mustNotContain(source, file, "ALLOW_RELEASE_ARTIFACTS=1 pnpm smoke:release");
}

function checkCleanerUx() {
  const file = "scripts/clean-release-artifacts.mjs";
  const source = read(file);

  for (const token of [
    "Tracked generated artifacts were not removed by release:clean.",
    "Remove them from git intentionally:",
    "git rm --",
    "readUntrackedGitPaths",
    "trackedArtifacts",
    "generatedFilePatterns",
    "dry-run",
    "/^.*\\\\.bak",
    "/^.*\\\\.backup",
    "/^.*\\\\.secret"
  ]) {
    mustContain(source, file, token);
  }
}

function checkWiringAndDocs() {
  const packageData = JSON.parse(read("package.json"));
  const scripts = packageData.scripts ?? {};
  mustContain(scripts["release:artifacts"] ?? "", "package.json#release:artifacts", "node scripts/check-release-artifacts.mjs");
  mustContain(scripts["release:clean"] ?? "", "package.json#release:clean", "node scripts/clean-release-artifacts.mjs");
  mustContain(scripts["security:release-artifact-guard-ux"] ?? "", "package.json#security:release-artifact-guard-ux", "node scripts/check-release-artifact-guard-ux-boundary.mjs");

  const betaRunner = read("scripts/run-beta-critical-smoke.mjs");
  mustContain(betaRunner, "scripts/run-beta-critical-smoke.mjs", "Release artifact guard");
  mustContain(betaRunner, "scripts/run-beta-critical-smoke.mjs", "release:artifacts");

  for (const file of [
    "docs/55-beta-critical-smoke-checklist.md",
    "docs/58-beta-critical-smoke-automation.md"
  ]) {
    const source = read(file);
    mustContain(source, file, "release:artifacts");
    mustContain(source, file, "release:clean");
    mustContain(source, file, "tracked generated artifacts");
    mustContain(source, file, "git rm");
  }
}

if (problems.length > 0) {
  console.error("Release artifact guard UX boundary failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Release artifact guard UX boundary passed.");

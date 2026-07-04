#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

const generatedExactPaths = [
  ".e2e-results",
  "playwright-report",
  "test-results",
  "apps/web/playwright-report",
  "apps/web/test-results",
  "apps/backoffice/playwright-report",
  "apps/backoffice/test-results",
  "apps/mobile/maestro-report",
  "apps/mobile/test-results",
];

const generatedFilePatterns = [
  /^babyloop-.*\.txt$/u,
  /^babyloop-.*\.zip$/u,
  /^babyloop-.*-(audit|target)\.txt$/u,
  /^babyloop-api-regression-target\.txt$/u,
  /^babyloop-backoffice-e2e-release-target\.txt$/u,
  /^web-full-flow\.json$/u,
  /^backoffice\.json$/u,
  /^.*\.bak(?:[-.].*)?$/u,
  /^.*\.bak.*$/u,
  /^\.env(?:\..*)?\.backup.*$/u,
  /^.*\.backup(?:[-.].*)?$/u,
  /^.*\.backup.*$/u,
  /^.*\.secret(?:[-.].*)?$/u,
  /^.*\.secret.*$/u,
];

if (process.env.ALLOW_RELEASE_ARTIFACTS === "1") {
  console.log("Release artifact guard skipped because ALLOW_RELEASE_ARTIFACTS=1.");
  process.exit(0);
}

const problems = new Set();

for (const relativePath of generatedExactPaths) {
  const absolutePath = path.join(root, relativePath);

  if (existsSync(absolutePath)) {
    problems.add(relativePath);
  }
}

for (const entry of safeReadDir(root)) {
  if (isGeneratedPath(entry)) {
    problems.add(entry);
  }
}

for (const relativePath of readGitPaths(["ls-files"])) {
  if (isGeneratedPath(relativePath)) {
    problems.add(relativePath);
  }
}

for (const relativePath of readUntrackedGitPaths()) {
  if (isGeneratedPath(relativePath)) {
    problems.add(relativePath);
  }
}

if (problems.size === 0) {
  console.log("Release artifact guard passed: no generated release/test artifacts found.");
  process.exit(0);
}

console.error("Release artifact guard failed. Remove generated artifacts before release smoke:");
for (const problem of [...problems].sort()) {
  console.error(`- ${problem}`);
}
console.error("");
console.error("Run: pnpm release:clean");
console.error("Tracked backup files must be removed with git rm.");
console.error("Or bypass intentionally with: ALLOW_RELEASE_ARTIFACTS=1 pnpm smoke:release");
process.exit(1);

function isGeneratedPath(relativePath) {
  const normalizedPath = relativePath.split(path.sep).join("/");

  if (
    generatedExactPaths.some((artifactPath) => {
      return normalizedPath === artifactPath || normalizedPath.startsWith(`${artifactPath}/`);
    })
  ) {
    return true;
  }

  return generatedFilePatterns.some((pattern) => pattern.test(path.basename(normalizedPath)));
}

function readGitPaths(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function readUntrackedGitPaths() {
  const result = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

function safeReadDir(directory) {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
}

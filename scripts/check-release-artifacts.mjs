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
  /^babyloop-.*\\.txt$/u,
  /^babyloop-.*\\.zip$/u,
  /^babyloop-.*-(audit|target)\\.txt$/u,
  /^babyloop-api-regression-target\\.txt$/u,
  /^babyloop-backoffice-e2e-release-target\\.txt$/u,
  /^web-full-flow\\.json$/u,
  /^backoffice\\.json$/u,
  /^.*\\.bak(?:[-.].*)?$/u,
  /^.*\\.bak.*$/u,
  /^\\.env(?:\\..*)?\\.backup.*$/u,
  /^.*\\.backup(?:[-.].*)?$/u,
  /^.*\\.backup.*$/u,
  /^.*\\.secret(?:[-.].*)?$/u,
  /^.*\\.secret.*$/u,
];

if (process.env.ALLOW_RELEASE_ARTIFACTS === "1") {
  console.warn("Release artifact guard skipped because ALLOW_RELEASE_ARTIFACTS=1.");
  console.warn("Use this only for an explicitly reviewed non-release diagnostic run.");
  process.exit(0);
}

const filesystemArtifacts = new Set();
const trackedArtifacts = new Set();
const untrackedArtifacts = new Set();

for (const relativePath of generatedExactPaths) {
  const absolutePath = path.join(root, relativePath);

  if (existsSync(absolutePath)) {
    filesystemArtifacts.add(relativePath);
  }
}

for (const entry of safeReadDir(root)) {
  if (isGeneratedPath(entry)) {
    filesystemArtifacts.add(entry);
  }
}

for (const relativePath of readGitPaths(["ls-files"])) {
  if (isGeneratedPath(relativePath)) {
    trackedArtifacts.add(relativePath);
  }
}

for (const relativePath of readUntrackedGitPaths()) {
  if (isGeneratedPath(relativePath)) {
    untrackedArtifacts.add(relativePath);
  }
}

const allProblems = new Set([
  ...filesystemArtifacts,
  ...trackedArtifacts,
  ...untrackedArtifacts,
]);

if (allProblems.size === 0) {
  console.log("Release artifact guard passed: no generated release/test artifacts found.");
  process.exit(0);
}

console.error("Release artifact guard failed.");
console.error("Generated release/test artifacts must be removed before release smoke.");
console.error("");

printSection(
  "Tracked generated artifacts (must be removed from git with git rm):",
  trackedArtifacts
);
printSection(
  "Untracked generated artifacts (usually cleanable with pnpm release:clean):",
  untrackedArtifacts
);
printSection(
  "Filesystem generated artifact paths (usually cleanable with pnpm release:clean):",
  filesystemArtifacts
);

console.error("Recommended cleanup:");
console.error("1. Run: pnpm release:clean");

if (trackedArtifacts.size > 0) {
  console.error("2. Remove tracked generated artifacts from the git index:");
  console.error("   git rm -- \\\\");
  for (const artifact of [...trackedArtifacts].sort()) {
    console.error(`     ${shellEscape(artifact)} \\\\`);
  }
  console.error("   # then commit the removal");
} else {
  console.error("2. No tracked generated artifacts were detected.");
}

console.error("3. Re-run: pnpm release:artifacts");
console.error("");
console.error("Bypass is not recommended for release/beta flows.");
console.error("Reviewed diagnostic-only bypass: ALLOW_RELEASE_ARTIFACTS=1 pnpm release:artifacts");
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

function printSection(title, values) {
  if (values.size === 0) {
    return;
  }

  console.error(title);
  for (const value of [...values].sort()) {
    console.error(`- ${value}`);
  }
  console.error("");
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
    .split("\\n")
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
    .split("\\n")
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

function shellEscape(value) {
  if (/^[A-Za-z0-9_./:-]+$/u.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\\\''")}'`;
}

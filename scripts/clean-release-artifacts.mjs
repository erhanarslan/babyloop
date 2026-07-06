#!/usr/bin/env node
import { existsSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const dryRun = process.argv.includes("--dry-run");

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

const trackedArtifacts = new Set(readGitPaths(["ls-files"]).filter(isGeneratedPath));
const targets = new Set();

for (const relativePath of generatedExactPaths) {
  if (existsSync(path.join(root, relativePath)) && !trackedArtifacts.has(relativePath)) {
    targets.add(relativePath);
  }
}

for (const entry of safeReadDir(root)) {
  if (isGeneratedPath(entry) && !trackedArtifacts.has(entry)) {
    targets.add(entry);
  }
}

for (const relativePath of readUntrackedGitPaths()) {
  if (isGeneratedPath(relativePath) && !trackedArtifacts.has(relativePath)) {
    targets.add(relativePath);
  }
}

if (targets.size === 0 && trackedArtifacts.size === 0) {
  console.log("No generated release/test artifacts found.");
  process.exit(0);
}

for (const relativePath of [...targets].sort()) {
  if (dryRun) {
    console.log(`[dry-run] remove ${relativePath}`);
    continue;
  }

  rmSync(path.join(root, relativePath), {
    force: true,
    recursive: true,
  });
  console.log(`removed ${relativePath}`);
}

if (trackedArtifacts.size > 0) {
  console.log("");
  console.log("Tracked generated artifacts were not removed by release:clean.");
  console.log("Remove them from git intentionally:");
  console.log("git rm -- \\\\");
  for (const artifact of [...trackedArtifacts].sort()) {
    console.log(`  ${shellEscape(artifact)} \\\\`);
  }
  console.log("# then commit the removal");
  process.exit(targets.size > 0 ? 0 : 1);
}

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

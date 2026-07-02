#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
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
  /^babyloop-.*-(audit|target)\.txt$/,
  /^babyloop-api-regression-target\.txt$/,
  /^babyloop-backoffice-e2e-release-target\.txt$/,
  /^web-full-flow\.json$/,
  /^backoffice\.json$/,
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
  if (generatedFilePatterns.some((pattern) => pattern.test(entry))) {
    problems.add(entry);
  }
}

const gitStatus = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
  cwd: root,
  encoding: "utf8",
});

if (gitStatus.status === 0) {
  for (const line of gitStatus.stdout.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("?? ")) {
      continue;
    }

    const relativePath = trimmed.slice(3).trim();

    if (
      generatedExactPaths.some((artifactPath) => {
        return relativePath === artifactPath || relativePath.startsWith(`${artifactPath}/`);
      }) ||
      generatedFilePatterns.some((pattern) => pattern.test(path.basename(relativePath)))
    ) {
      problems.add(relativePath);
    }
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
console.error("Or bypass intentionally with: ALLOW_RELEASE_ARTIFACTS=1 pnpm smoke:release");
process.exit(1);

function safeReadDir(directory) {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
}

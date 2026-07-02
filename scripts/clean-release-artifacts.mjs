#!/usr/bin/env node
import { existsSync, readdirSync, rmSync } from "node:fs";
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
  /^babyloop-.*-(audit|target)\.txt$/,
  /^babyloop-api-regression-target\.txt$/,
  /^babyloop-backoffice-e2e-release-target\.txt$/,
  /^web-full-flow\.json$/,
  /^backoffice\.json$/,
];

const targets = new Set();

for (const relativePath of generatedExactPaths) {
  if (existsSync(path.join(root, relativePath))) {
    targets.add(relativePath);
  }
}

for (const entry of safeReadDir(root)) {
  if (generatedFilePatterns.some((pattern) => pattern.test(entry))) {
    targets.add(entry);
  }
}

if (targets.size === 0) {
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

function safeReadDir(directory) {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
}

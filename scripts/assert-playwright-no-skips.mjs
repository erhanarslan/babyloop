#!/usr/bin/env node
import fs from "node:fs";

const reportPath = process.argv[2];

if (!reportPath) {
  console.error("Usage: node scripts/assert-playwright-no-skips.mjs <playwright-json-report>");
  process.exit(1);
}

if (!fs.existsSync(reportPath)) {
  console.error(`Playwright JSON report not found: ${reportPath}`);
  process.exit(1);
}

let report;

try {
  report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
} catch (error) {
  console.error(`Could not parse Playwright JSON report: ${reportPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const skipped = [];
const failed = [];
const passed = [];

function joinTitle(parts) {
  return parts.filter(Boolean).join(" › ");
}

function visitSuite(suite, parents = []) {
  const suiteTitle = suite?.title;
  const currentParents = suiteTitle ? [...parents, suiteTitle] : parents;

  for (const spec of suite?.specs ?? []) {
    const specTitle = joinTitle([...currentParents, spec.title]);

    for (const test of spec.tests ?? []) {
      const projectPrefix = test.projectName ? `[${test.projectName}] ` : "";
      const testTitle = `${projectPrefix}${specTitle}`;
      const results = Array.isArray(test.results) ? test.results : [];
      const statuses = results.map((result) => result.status);

      if (test.expectedStatus === "skipped" || statuses.includes("skipped")) {
        skipped.push(testTitle);
        continue;
      }

      if (
        statuses.includes("failed") ||
        statuses.includes("timedOut") ||
        statuses.includes("interrupted") ||
        test.outcome === "unexpected"
      ) {
        failed.push(testTitle);
        continue;
      }

      passed.push(testTitle);
    }
  }

  for (const childSuite of suite?.suites ?? []) {
    visitSuite(childSuite, currentParents);
  }
}

for (const suite of report.suites ?? []) {
  visitSuite(suite);
}

const total = passed.length + failed.length + skipped.length;

console.log(`Playwright guard summary: ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped, ${total} total`);

if (total === 0) {
  console.error("No Playwright tests were found in the JSON report.");
  process.exit(1);
}

if (failed.length > 0) {
  console.error("\nFailed tests:");
  for (const testTitle of failed) {
    console.error(`- ${testTitle}`);
  }
  process.exit(1);
}

if (skipped.length > 0) {
  console.error("\nSkipped tests are not allowed in guarded E2E runs:");
  for (const testTitle of skipped) {
    console.error(`- ${testTitle}`);
  }
  process.exit(1);
}

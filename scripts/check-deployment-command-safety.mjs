#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const JAVASCRIPT_EXECUTION_FILES = Object.freeze([
  "scripts/deploy/adapters/docker-compose.mjs",
  "scripts/deploy/adapters/gcp-cloud-run.mjs",
  "scripts/deploy/assemble-image-manifest.mjs",
  "scripts/deploy/audit-runtime-env.mjs",
  "scripts/deploy/check-runtime-env-readiness.mjs",
  "scripts/deploy/create-staging-bootstrap-plan.mjs",
  "scripts/deploy/deployment-smoke-contract.mjs",
  "scripts/deploy/deployment-lib.mjs",
  "scripts/deploy/execute-staging-deploy.mjs",
  "scripts/deploy/post-deploy-smoke.mjs",
  "scripts/deploy/release-orchestration-lib.mjs",
  "scripts/deploy/rehearse-cloud-run-release.mjs",
  "scripts/deploy/resolve-release-contract.mjs",
  "scripts/deploy/record-release-metadata.mjs",
  "scripts/deploy/capture-cloud-run-rollback.mjs",
  "scripts/deploy/rollback-cloud-run-release.mjs",
  "scripts/deploy/write-release-summary.mjs",
  "scripts/deploy/run-environment-smoke.mjs",
  "scripts/deploy/promote-release.mjs",
  "scripts/deploy/provider-probe.mjs",
  "scripts/deploy/release-evidence-lib.mjs",
  "scripts/deploy/release-go-no-go.mjs",
  "scripts/deploy/render-compose-plan.mjs",
  "scripts/deploy/runtime-env-lib.mjs",
  "scripts/deploy/sign-manual-evidence.mjs",
  "scripts/deploy/verify-release-evidence.mjs",
  "scripts/deploy/worker-loop.mjs",
  "scripts/gcp/cloud-run-lib.mjs",
  "scripts/gcp/plan-cloud-run.mjs",
  "scripts/gcp/bootstrap-cloud-run.mjs",
  "scripts/gcp/audit-cloud-run-iam.mjs",
  "scripts/gcp/repair-cloud-run-iam.mjs",
  "scripts/gcp/import-runtime-env.mjs",
  "scripts/gcp/build-cloud-run-images.mjs",
  "scripts/gcp/deploy-cloud-run.mjs",
  "scripts/gcp/execute-cloud-run-migration.mjs",
  "scripts/gcp/map-cloud-run-domains.mjs",
  "scripts/ops/database-release-safety.mjs",
  "scripts/ops/postgres-backup.mjs",
  "scripts/ops/postgres-ops-lib.mjs",
  "scripts/ops/postgres-restore-smoke.mjs",
  "scripts/ops/postgres-restore.mjs",
  "scripts/ops/release-manifest.mjs",
  "scripts/ops/release-ops-lib.mjs",
  "scripts/ops/release-rollback.mjs"
]);

export const SHELL_EXECUTION_FILES = Object.freeze([
  "scripts/deploy/staging-bootstrap.sh",
  "scripts/release-candidate-preflight.sh"
]);

export function stripJavaScriptNonCode(source) {
  let output = "";
  let state = "code";
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1] ?? "";

    if (state === "line-comment") {
      if (char === "\n") {
        state = "code";
        output += "\n";
      } else {
        output += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "code";
      } else {
        output += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (state !== "code") {
      if (escaped) {
        output += char === "\n" ? "\n" : " ";
        escaped = false;
        continue;
      }
      if (char === "\\") {
        output += " ";
        escaped = true;
        continue;
      }

      const closes =
        (state === "single-quote" && char === "'") ||
        (state === "double-quote" && char === '"') ||
        (state === "template" && char === "`");

      output += char === "\n" ? "\n" : " ";
      if (closes) state = "code";
      continue;
    }

    if (char === "/" && next === "/") {
      output += "  ";
      index += 1;
      state = "line-comment";
      continue;
    }
    if (char === "/" && next === "*") {
      output += "  ";
      index += 1;
      state = "block-comment";
      continue;
    }
    if (char === "'") {
      output += " ";
      state = "single-quote";
      continue;
    }
    if (char === '"') {
      output += " ";
      state = "double-quote";
      continue;
    }
    if (char === "`") {
      output += " ";
      state = "template";
      continue;
    }

    output += char;
  }

  return output;
}

export function inspectJavaScriptSource(source, file = "<javascript>") {
  const code = stripJavaScriptNonCode(source);
  const violations = [];

  if (/\bshell\s*:\s*true\b/u.test(code)) {
    violations.push(`${file} enables child-process shell execution with shell: true.`);
  }

  return violations;
}

export function inspectShellSource(source, file = "<shell>") {
  const violations = [];

  source.split(/\r?\n/u).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const lineNumber = index + 1;
    if (/^(?:source|\.)\s+/u.test(trimmed)) {
      violations.push(
        `${file}:${lineNumber} evaluates another file with source/dot syntax.`
      );
    }
    if (/^eval(?:\s|$)/u.test(trimmed)) {
      violations.push(`${file}:${lineNumber} uses eval.`);
    }
    if (/(?:^|[;&|]\s*)(?:bash|sh)\s+-c(?:\s|$)/u.test(trimmed)) {
      violations.push(`${file}:${lineNumber} invokes a shell with -c.`);
    }
  });

  return violations;
}

export async function checkDeploymentCommandSafety({
  javascriptFiles = JAVASCRIPT_EXECUTION_FILES,
  shellFiles = SHELL_EXECUTION_FILES
} = {}) {
  const violations = [];

  for (const file of javascriptFiles) {
    const source = await readFile(file, "utf8");
    violations.push(...inspectJavaScriptSource(source, file));
  }

  for (const file of shellFiles) {
    const source = await readFile(file, "utf8");
    violations.push(...inspectShellSource(source, file));
  }

  if (violations.length > 0) {
    throw new Error(violations.join("\n"));
  }

  return {
    javascriptFiles: javascriptFiles.length,
    shellFiles: shellFiles.length
  };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";

if (invokedPath === import.meta.url) {
  try {
    const result = await checkDeploymentCommandSafety();
    console.log(
      `Deployment command safety guard passed for ${result.javascriptFiles} JavaScript and ${result.shellFiles} shell execution file(s).`
    );
  } catch (error) {
    console.error("Deployment command safety guard failed:");
    for (const line of String(
      error instanceof Error ? error.message : error
    ).split("\n")) {
      console.error(`- ${line}`);
    }
    process.exit(1);
  }
}

#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import {
  artifactRoot,
  assertFullGitSha,
  assertEnvironment,
  assertGcloudContext,
  gcloud,
  loadCloudRunContract,
  parseFlag,
  run,
  safeMessage,
  writeJson
} from "./cloud-run-lib.mjs";

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const { contract } = await loadCloudRunContract();
  const expected = `APPLY_${environment.toUpperCase()}`;
  if (process.env.GCP_MIGRATION_CONFIRM !== expected) throw new Error(`GCP_MIGRATION_CONFIRM must equal ${expected}.`);
  const context = await assertGcloudContext(contract, environment, { mutation: true });
  const execution = await gcloud(buildMigrationExecutionArgs({ contract, context }), { capture: true });
  const root = artifactRoot(contract, environment);
  const sourceGitSha = assertFullGitSha(
    process.env.RELEASE_SOURCE_GIT_SHA
      || process.env.GITHUB_SHA
      || (await run("git", ["rev-parse", "HEAD"], { capture: true })).stdout.trim(),
    "release git SHA"
  );
  await mkdir(root, { recursive: true, mode: 0o700 });
  const logPath = resolve(root, "cloud-run-migration.log");
  await writeFile(
    logPath,
    `${execution.stdout}${execution.stderr}`.replace(/(postgres(?:ql)?:\/\/)[^\s]+/giu, "$1[REDACTED]"),
    { mode: 0o600 }
  );
  const receipt = await writeJson(resolve(artifactRoot(contract, environment), "cloud-run-migration.json"), {
    schemaVersion: 1,
    kind: "gcp_cloud_run_migration",
    status: "completed",
    createdAt: new Date().toISOString(),
    environment,
    gitSha: sourceGitSha,
    project: context.project,
    region: contract.region,
    job: contract.jobs.migrate.name,
    confirmation: expected,
    logPath
  });
  console.log(JSON.stringify({ ok: true, environment, project: context.project, receipt: receipt.path, logPath }, null, 2));
}

export function buildMigrationExecutionArgs({ contract, context }) {
  return [
    "run", "jobs", "execute", contract.jobs.migrate.name,
    `--region=${contract.region}`,
    `--project=${context.project}`,
    "--wait"
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
    process.exitCode = 1;
  });
}

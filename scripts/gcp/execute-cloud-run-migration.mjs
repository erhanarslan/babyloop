#!/usr/bin/env node
import { resolve } from "node:path";
import {
  artifactRoot,
  assertEnvironment,
  assertGcloudContext,
  gcloud,
  loadCloudRunContract,
  parseFlag,
  safeMessage,
  writeJson
} from "./cloud-run-lib.mjs";
import {
  pollForMigrationEvidence,
  readExecutionName,
  readExpectedMigrationHead
} from "./migration-head-lib.mjs";

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const { contract } = await loadCloudRunContract();
  const expected = `APPLY_${environment.toUpperCase()}`;
  if (process.env.GCP_MIGRATION_CONFIRM !== expected) throw new Error(`GCP_MIGRATION_CONFIRM must equal ${expected}.`);
  const context = await assertGcloudContext(contract, environment);
  const executionResult = await gcloud([
    "run", "jobs", "execute", contract.jobs.migrate.name,
    `--region=${contract.region}`, `--project=${context.project}`, "--wait", "--format=json"
  ], { capture: true });
  const executionName = readExecutionName(JSON.parse(executionResult.stdout));
  const expectedHead = await readExpectedMigrationHead();
  const verification = await readVerifiedMigrationLog({
    contract,
    executionName,
    job: contract.jobs.migrate.name,
    project: context.project,
    expectedHead
  });
  const {
    expectedMigrationTag,
    expectedMigrationHash,
    actualMigrationHash,
    verifiedTables,
    verifiedAt
  } = verification;
  const receipt = await writeJson(resolve(artifactRoot(contract, environment), "cloud-run-migration.json"), {
    schemaVersion: 1,
    kind: "gcp_cloud_run_migration",
    status: "completed",
    createdAt: new Date().toISOString(),
    environment,
    project: context.project,
    region: contract.region,
    job: contract.jobs.migrate.name,
    execution: executionName,
    confirmation: expected,
    expectedMigrationTag,
    expectedMigrationHash,
    actualMigrationHash,
    verifiedTables,
    verifiedAt
  });
  console.log(JSON.stringify({ ok: true, environment, project: context.project, receipt: receipt.path }, null, 2));
}

async function readVerifiedMigrationLog({ contract, executionName, job, project, expectedHead }) {
  const filter = [
    "resource.type=cloud_run_job",
    `resource.labels.job_name=${job}`,
    `resource.labels.location=${contract.region}`,
    `labels.\"run.googleapis.com/execution_name\"=${executionName}`,
    "jsonPayload.event=migration_head_verified"
  ].join(" AND ");

  return pollForMigrationEvidence({
    executionName,
    expected: expectedHead,
    readEntries: async () => {
      const result = await gcloud([
        "logging", "read", filter,
        `--project=${project}`,
        "--limit=10",
        "--order=desc",
        "--format=json"
      ], { capture: true });
      return JSON.parse(result.stdout || "[]");
    },
  });
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
  process.exitCode = 1;
});

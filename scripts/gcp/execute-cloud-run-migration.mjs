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

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const { contract } = await loadCloudRunContract();
  const expected = `APPLY_${environment.toUpperCase()}`;
  if (process.env.GCP_MIGRATION_CONFIRM !== expected) throw new Error(`GCP_MIGRATION_CONFIRM must equal ${expected}.`);
  const context = await assertGcloudContext(contract, environment);
  await gcloud([
    "run", "jobs", "execute", contract.jobs.migrate.name,
    `--region=${contract.region}`, `--project=${context.project}`, "--wait"
  ]);
  const receipt = await writeJson(resolve(artifactRoot(contract, environment), "cloud-run-migration.json"), {
    schemaVersion: 1,
    kind: "gcp_cloud_run_migration",
    status: "completed",
    createdAt: new Date().toISOString(),
    environment,
    project: context.project,
    region: contract.region,
    job: contract.jobs.migrate.name,
    confirmation: expected
  });
  console.log(JSON.stringify({ ok: true, environment, project: context.project, receipt: receipt.path }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
  process.exitCode = 1;
});

#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertDigestImage,
  assertEnvironment,
  assertGcloudContext,
  loadCloudRunContract,
  gcloud,
  run,
  safeMessage
} from "../../gcp/cloud-run-lib.mjs";

async function main() {
  const planPath = resolve(process.argv[2] || "");
  if (!planPath) throw new Error("Rollback plan path is required.");
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const environment = assertEnvironment(plan.environment);
  const { contract } = await loadCloudRunContract();
  await assertGcloudContext(contract, environment);
  const expected = `ROLLBACK_GCP_${environment.toUpperCase()}`;
  if (process.env.GCP_ROLLBACK_CONFIRM !== expected) {
    throw new Error(`GCP_ROLLBACK_CONFIRM must equal ${expected}.`);
  }
  for (const target of ["api", "web", "backoffice"]) {
    const image = assertDigestImage(plan.services?.[target]?.image, `${target} rollback image`);
    await gcloud([
      "run", "services", "update", contract.services[target].name,
      `--image=${image}`,
      `--region=${contract.region}`,
      `--project=${contract.projects[environment]}`
    ]);
  }
  if (!process.env.DEPLOY_ENV_FILE) {
    throw new Error("DEPLOY_ENV_FILE is required for post-rollback smoke.");
  }
  await run(process.execPath, [
    "--env-file", process.env.DEPLOY_ENV_FILE,
    "scripts/deploy/run-environment-smoke.mjs",
    environment
  ]);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    environment,
    schemaAction: "keep_current_schema",
    targetReleaseId: plan.toReleaseId
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
  process.exitCode = 1;
});

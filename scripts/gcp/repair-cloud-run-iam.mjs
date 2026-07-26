#!/usr/bin/env node
import { resolve } from "node:path";
import {
  artifactRoot,
  assertConfirmation,
  assertEnvironment,
  assertGcloudContext,
  gcloud,
  gcloudResourceExists,
  loadCloudRunContract,
  parseFlag,
  safeMessage,
  serviceAccountEmail,
  writeJson
} from "./cloud-run-lib.mjs";
import {
  policyHasMember,
  RUN_INVOKER_ROLE,
  scheduledJobEntries,
  schedulerMember
} from "./cloud-run-iam-lib.mjs";

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const { contract, sha256 } = await loadCloudRunContract();
  assertConfirmation("iam-repair", environment);
  const context = await assertGcloudContext(contract, environment);
  const schedulerEmail = serviceAccountEmail(
    contract,
    "scheduler",
    context.project
  );
  const principal = schedulerMember(schedulerEmail);

  const projectPolicy = JSON.parse(
    (
      await gcloud(
        ["projects", "get-iam-policy", context.project, "--format=json"],
        { capture: true }
      )
    ).stdout
  );

  let removedProjectWideInvoker = false;
  if (
    policyHasMember(
      projectPolicy,
      RUN_INVOKER_ROLE,
      principal
    )
  ) {
    await gcloud([
      "projects",
      "remove-iam-policy-binding",
      context.project,
      `--member=${principal}`,
      `--role=${RUN_INVOKER_ROLE}`,
      "--condition=None"
    ]);
    removedProjectWideInvoker = true;
  }

  const jobBindings = {};
  for (const [key, config] of scheduledJobEntries(contract)) {
    const exists = await gcloudResourceExists(
      [
        "run",
        "jobs",
        "describe",
        config.name,
        `--region=${contract.region}`,
        `--project=${context.project}`
      ],
      { resource: `Cloud Run job ${config.name}` }
    );
    if (exists) {
      await gcloud([
        "run",
        "jobs",
        "add-iam-policy-binding",
        config.name,
        `--region=${contract.region}`,
        `--project=${context.project}`,
        `--member=${principal}`,
        `--role=${RUN_INVOKER_ROLE}`
      ]);
    }
    jobBindings[key] = {
      name: config.name,
      exists,
      schedulerScopedInvoker: exists
    };
  }

  const output =
    parseFlag("output") ||
    resolve(
      artifactRoot(contract, environment),
      "cloud-run-iam-repair.json"
    );
  const receipt = await writeJson(output, {
    schemaVersion: 1,
    kind: "gcp_cloud_run_iam_repair",
    status: "applied",
    createdAt: new Date().toISOString(),
    environment,
    project: context.project,
    region: contract.region,
    contractSha256: sha256,
    scheduler: {
      email: schedulerEmail,
      removedProjectWideInvoker
    },
    scheduledJobs: jobBindings,
    confirmation: `GCP_IAM_REPAIR_CONFIRM=IAM_REPAIR_${environment.toUpperCase()}`
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        environment,
        project: context.project,
        removedProjectWideInvoker,
        scheduledJobs: jobBindings,
        output: receipt.path
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({ ok: false, error: safeMessage(error) })
  );
  process.exitCode = 1;
});

#!/usr/bin/env node
import { resolve } from "node:path";
import {
  artifactRoot,
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
  const projectWideInvoker = policyHasMember(
    projectPolicy,
    RUN_INVOKER_ROLE,
    principal
  );

  const jobs = {};
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
    let scopedInvoker = false;
    if (exists) {
      const policy = JSON.parse(
        (
          await gcloud(
            [
              "run",
              "jobs",
              "get-iam-policy",
              config.name,
              `--region=${contract.region}`,
              `--project=${context.project}`,
              "--format=json"
            ],
            { capture: true }
          )
        ).stdout || "{}"
      );
      scopedInvoker = policyHasMember(policy, RUN_INVOKER_ROLE, principal);
    }
    jobs[key] = {
      name: config.name,
      exists,
      schedulerScopedInvoker: scopedInvoker
    };
  }

  const status =
    !projectWideInvoker &&
    Object.values(jobs).every(
      (job) => !job.exists || job.schedulerScopedInvoker
    )
      ? "pass"
      : "fail";

  const output =
    parseFlag("output") ||
    resolve(
      artifactRoot(contract, environment),
      "cloud-run-iam-audit.json"
    );
  const receipt = await writeJson(output, {
    schemaVersion: 1,
    kind: "gcp_cloud_run_iam_audit",
    status,
    createdAt: new Date().toISOString(),
    environment,
    project: context.project,
    region: contract.region,
    contractSha256: sha256,
    scheduler: {
      email: schedulerEmail,
      projectWideInvoker
    },
    scheduledJobs: jobs
  });

  console.log(
    JSON.stringify(
      {
        ok: status === "pass",
        environment,
        project: context.project,
        projectWideInvoker,
        scheduledJobs: jobs,
        output: receipt.path
      },
      null,
      2
    )
  );

  if (status !== "pass") process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    JSON.stringify({ ok: false, error: safeMessage(error) })
  );
  process.exitCode = 1;
});

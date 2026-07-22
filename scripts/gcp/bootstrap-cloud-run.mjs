#!/usr/bin/env node
import { resolve } from "node:path";
import {
  policyHasMember,
  RUN_INVOKER_ROLE,
  schedulerMember
} from "./cloud-run-iam-lib.mjs";
import {
  artifactRoot,
  assertConfirmation,
  assertEnvironment,
  assertGcloudContext,
  gcloud,
  loadCloudRunContract,
  parseFlag,
  safeMessage,
  serviceAccountEmail,
  writeJson
} from "./cloud-run-lib.mjs";

async function exists(args) {
  try {
    await gcloud(args, { capture: true });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const { contract, sha256 } = await loadCloudRunContract();
  assertConfirmation("bootstrap", environment);
  const context = await assertGcloudContext(contract, environment);

  await gcloud(["services", "enable", ...contract.requiredApis, `--project=${context.project}`]);

  const repositoryExists = await exists([
    "artifacts", "repositories", "describe", contract.repository,
    `--location=${contract.region}`, `--project=${context.project}`
  ]);
  if (!repositoryExists) {
    await gcloud([
      "artifacts", "repositories", "create", contract.repository,
      "--repository-format=docker",
      `--location=${contract.region}`,
      "--description=BabyLoop immutable Cloud Run images",
      `--project=${context.project}`
    ]);
  }

  const createdAccounts = [];
  for (const [role, id] of Object.entries(contract.serviceAccounts)) {
    const email = serviceAccountEmail(contract, role, context.project);
    const accountExists = await exists(["iam", "service-accounts", "describe", email, `--project=${context.project}`]);
    if (!accountExists) {
      await gcloud([
        "iam", "service-accounts", "create", id,
        `--display-name=BabyLoop ${environment} ${role} runtime`,
        `--project=${context.project}`
      ]);
      createdAccounts.push(email);
    }
  }

  const schedulerEmail = serviceAccountEmail(contract, "scheduler", context.project);
  const schedulerPrincipal = schedulerMember(schedulerEmail);
  const projectPolicy = JSON.parse(
    (
      await gcloud(
        ["projects", "get-iam-policy", context.project, "--format=json"],
        { capture: true }
      )
    ).stdout
  );
  let removedLegacyProjectInvokerBinding = false;
  if (policyHasMember(projectPolicy, RUN_INVOKER_ROLE, schedulerPrincipal)) {
    await gcloud([
      "projects", "remove-iam-policy-binding", context.project,
      `--member=${schedulerPrincipal}`,
      `--role=${RUN_INVOKER_ROLE}`,
      "--condition=None"
    ]);
    removedLegacyProjectInvokerBinding = true;
  }

  const output = parseFlag("output") || resolve(artifactRoot(contract, environment), "cloud-run-bootstrap.json");
  const receipt = await writeJson(output, {
    schemaVersion: 1,
    kind: "gcp_cloud_run_bootstrap",
    status: "applied",
    createdAt: new Date().toISOString(),
    environment,
    project: context.project,
    projectNumber: context.projectNumber,
    account: context.account,
    region: contract.region,
    contractSha256: sha256,
    repository: `${contract.region}-docker.pkg.dev/${context.project}/${contract.repository}`,
    serviceAccounts: Object.fromEntries(Object.keys(contract.serviceAccounts).map((role) => [role, serviceAccountEmail(contract, role, context.project)])),
    createdServiceAccounts: createdAccounts,
    schedulerIam: {
      projectWideInvoker: false,
      removedLegacyProjectInvokerBinding
    },
    confirmation: `GCP_BOOTSTRAP_CONFIRM=BOOTSTRAP_${environment.toUpperCase()}`
  });
  console.log(JSON.stringify({ ok: true, environment, project: context.project, output: receipt.path }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
  process.exitCode = 1;
});

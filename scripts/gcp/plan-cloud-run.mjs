#!/usr/bin/env node
import { resolve } from "node:path";
import {
  artifactRoot,
  assertEnvironment,
  assertGcloudContext,
  gcloud,
  gcloudJsonResource,
  loadCloudRunContract,
  parseFlag,
  safeMessage,
  serviceAccountEmail,
  writeJson
} from "./cloud-run-lib.mjs";

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const { contract, sha256 } = await loadCloudRunContract();
  const context = await assertGcloudContext(contract, environment);
  const enabledResult = await gcloud(["services", "list", "--enabled", "--format=value(config.name)"], { capture: true });
  const enabled = new Set(enabledResult.stdout.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean));
  const missingApis = contract.requiredApis.filter((api) => !enabled.has(api));
  const repository = await gcloudJsonResource(
    [
      "artifacts", "repositories", "describe", contract.repository,
      `--location=${contract.region}`
    ],
    { resource: `Artifact Registry repository ${contract.repository}` }
  );
  const accounts = {};
  for (const role of Object.keys(contract.serviceAccounts)) {
    const email = serviceAccountEmail(contract, role, context.project);
    accounts[role] = {
      email,
      exists: Boolean(await gcloudJsonResource(
        ["iam", "service-accounts", "describe", email],
        { resource: `service account ${email}` }
      ))
    };
  }
  const services = {};
  for (const [key, config] of Object.entries(contract.services)) {
    services[key] = {
      name: config.name,
      current: await gcloudJsonResource(
        ["run", "services", "describe", config.name, `--region=${contract.region}`],
        { resource: `Cloud Run service ${config.name}` }
      )
    };
  }
  const jobs = {};
  for (const [key, config] of Object.entries(contract.jobs)) {
    jobs[key] = {
      name: config.name,
      current: await gcloudJsonResource(
        ["run", "jobs", "describe", config.name, `--region=${contract.region}`],
        { resource: `Cloud Run job ${config.name}` }
      )
    };
  }
  const output = parseFlag("output") || resolve(artifactRoot(contract, environment), "cloud-run-plan.json");
  const receipt = await writeJson(output, {
    schemaVersion: 1,
    kind: "gcp_cloud_run_plan",
    createdAt: new Date().toISOString(),
    environment,
    project: context.project,
    projectNumber: context.projectNumber,
    account: context.account,
    region: contract.region,
    contractSha256: sha256,
    missingApis,
    repository: repository ? { exists: true, name: repository.name, format: repository.format } : { exists: false },
    serviceAccounts: accounts,
    services: Object.fromEntries(Object.entries(services).map(([key, value]) => [key, { name: value.name, exists: Boolean(value.current) }])),
    jobs: Object.fromEntries(Object.entries(jobs).map(([key, value]) => [key, { name: value.name, exists: Boolean(value.current) }])),
    mutation: false
  });
  console.log(JSON.stringify({ ok: true, environment, project: context.project, output: receipt.path, missingApis }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
  process.exitCode = 1;
});

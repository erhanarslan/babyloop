#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  RUN_INVOKER_ROLE,
  schedulerMember
} from "./cloud-run-iam-lib.mjs";
import {
  artifactRoot,
  assertConfirmation,
  assertDigestImage,
  assertEnvironment,
  assertFullGitSha,
  assertGcloudContext,
  gcloud,
  loadCloudRunContract,
  parseFlag,
  run,
  safeMessage,
  serviceAccountEmail,
  writeJson
} from "./cloud-run-lib.mjs";

async function readProtectedJson(path) {
  const resolved = resolve(path);
  const [content, checksumLine] = await Promise.all([
    readFile(resolved, "utf8"), readFile(`${resolved}.sha256`, "utf8")
  ]);
  const expected = checksumLine.trim().split(/\s+/u)[0];
  const actual = createHash("sha256").update(content).digest("hex");
  if (expected !== actual) throw new Error(`Checksum mismatch for ${resolved}.`);
  return JSON.parse(content);
}

function secretFlag(manifest) {
  return Object.entries(manifest.secretBindings || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}

async function deployService({ config, role, image, environment, context, contract, envFile, secrets }) {
  const args = [
    "run", "deploy", config.name,
    `--image=${image}`,
    `--region=${contract.region}`,
    `--project=${context.project}`,
    `--service-account=${serviceAccountEmail(contract, role, context.project)}`,
    "--execution-environment=gen2",
    "--ingress=all",
    `--cpu=${config.cpu}`,
    `--memory=${config.memory}`,
    `--concurrency=${config.concurrency}`,
    `--timeout=${config.timeout}`,
    `--min-instances=${config.minInstances}`,
    `--max-instances=${config.maxInstances}`,
    `--labels=application=babyloop,environment=${environment},component=${role}`,
    "--allow-unauthenticated"
  ];
  if (role === "api") {
    args.push(`--env-vars-file=${envFile}`);
    if (secrets) args.push(`--set-secrets=${secrets}`);
  } else {
    args.push(`--set-env-vars=NODE_ENV=production,DEPLOY_ENVIRONMENT=${environment}`);
  }
  await gcloud(args);
  const result = await gcloud([
    "run", "services", "describe", config.name,
    `--region=${contract.region}`, `--project=${context.project}`, "--format=value(status.url)"
  ], { capture: true });
  return result.stdout.trim();
}

async function deployJob({ config, key, image, environment, context, contract, envFile, secrets, migrationEnvFile }) {
  const args = [
    "run", "jobs", "deploy", config.name,
    `--image=${image}`,
    `--region=${contract.region}`,
    `--project=${context.project}`,
    `--service-account=${serviceAccountEmail(contract, "jobs", context.project)}`,
    `--cpu=${config.cpu}`,
    `--memory=${config.memory}`,
    `--tasks=1`, "--parallelism=1",
    `--max-retries=${config.maxRetries}`,
    `--task-timeout=${config.timeout}`,
    "--command=node",
    `--args=${config.script}`,
    `--labels=application=babyloop,environment=${environment},component=${key}`,
    `--env-vars-file=${key === "migrate" ? migrationEnvFile : envFile}`
  ];
  if (secrets) args.push(`--set-secrets=${secrets}`);
  await gcloud(args);
}

async function schedulerExists(name, contract, project) {
  try {
    await gcloud(["scheduler", "jobs", "describe", name, `--location=${contract.schedulerRegion}`, `--project=${project}`], { capture: true });
    return true;
  } catch {
    return false;
  }
}

async function grantSchedulerJobInvocation({
  config,
  context,
  contract
}) {
  const schedulerEmail = serviceAccountEmail(
    contract,
    "scheduler",
    context.project
  );
  await gcloud([
    "run",
    "jobs",
    "add-iam-policy-binding",
    config.name,
    `--region=${contract.region}`,
    `--project=${context.project}`,
    `--member=${schedulerMember(schedulerEmail)}`,
    `--role=${RUN_INVOKER_ROLE}`
  ]);
}

async function upsertScheduler({ key, config, context, contract, environment }) {
  const name = `${config.name}-schedule`;
  const verb = await schedulerExists(name, contract, context.project) ? "update" : "create";
  const uri = `https://run.googleapis.com/v2/projects/${context.project}/locations/${contract.region}/jobs/${config.name}:run`;
  await gcloud([
    "scheduler", "jobs", verb, "http", name,
    `--location=${contract.schedulerRegion}`,
    `--project=${context.project}`,
    `--schedule=${config.schedule}`,
    `--time-zone=${contract.timezone}`,
    `--uri=${uri}`,
    "--http-method=POST",
    `--oauth-service-account-email=${serviceAccountEmail(contract, "scheduler", context.project)}`,
    "--oauth-token-scope=https://www.googleapis.com/auth/cloud-platform",
    "--headers=Content-Type=application/json",
    "--message-body={}",
    "--attempt-deadline=320s",
    `--description=BabyLoop ${environment} ${key} Cloud Run Job trigger`
  ]);
}

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const phase = parseFlag("phase") || "all";
  if (!["all", "migration", "services"].includes(phase)) {
    throw new Error("--phase must be all, migration, or services.");
  }
  const manifestPath = parseFlag("image-manifest") || resolve(artifactRoot((await loadCloudRunContract()).contract, environment), "cloud-run-image-manifest.json");
  const secretManifestPath = parseFlag("secret-manifest") || resolve(artifactRoot((await loadCloudRunContract()).contract, environment), "secret-manifest.json");
  const { contract, sha256 } = await loadCloudRunContract();
  assertConfirmation("deploy", environment);
  const context = await assertGcloudContext(contract, environment);
  const [images, secrets] = await Promise.all([readProtectedJson(manifestPath), readProtectedJson(secretManifestPath)]);
  if (images.environment !== environment || images.project !== context.project) throw new Error("Image manifest environment/project mismatch.");
  if (secrets.environment !== environment || secrets.project !== context.project) throw new Error("Secret manifest environment/project mismatch.");
  if (images.contractSha256 !== sha256) throw new Error("Image manifest uses a different Cloud Run contract.");
  const gitResult = await run("git", ["rev-parse", "HEAD"], { capture: true });
  const headGitSha = assertFullGitSha(gitResult.stdout.trim());
  const gitSha = assertFullGitSha(process.env.RELEASE_SOURCE_GIT_SHA || headGitSha, "RELEASE_SOURCE_GIT_SHA");
  if (images.gitSha !== gitSha) throw new Error(`Image manifest gitSha ${images.gitSha} does not match release source ${gitSha}.`);
  if (gitSha !== headGitSha) {
    await run("git", ["diff", "--quiet", gitSha, headGitSha]);
  }
  for (const key of ["api", "web", "backoffice"]) assertDigestImage(images.images[key], `${key} image`);
  const secretBindings = secretFlag(secrets);
  const envFile = resolve(secrets.nonSecretEnvFile);
  const migrationEnvFile = resolve(artifactRoot(contract, environment), "migration-runtime.env.yaml");
  const apiEnvSource = await readFile(envFile, "utf8");
  await writeFile(migrationEnvFile, `${apiEnvSource}MIGRATION_CONFIRM: ${JSON.stringify(`APPLY_${environment.toUpperCase()}`)}\n`, { mode: 0o600 });

  const urls = {};
  if (phase !== "migration") {
    urls.api = await deployService({ config: contract.services.api, role: "api", image: images.images.api, environment, context, contract, envFile, secrets: secretBindings });
    urls.web = await deployService({ config: contract.services.web, role: "web", image: images.images.web, environment, context, contract, envFile, secrets: "" });
    urls.backoffice = await deployService({ config: contract.services.backoffice, role: "backoffice", image: images.images.backoffice, environment, context, contract, envFile, secrets: "" });
  }

  for (const [key, config] of Object.entries(contract.jobs)) {
    if (phase === "migration" && key !== "migrate") continue;
    if (phase === "services" && key === "migrate") continue;
    await deployJob({ config, key, image: images.images.api, environment, context, contract, envFile, secrets: secretBindings, migrationEnvFile });
    if (config.schedule) {
      await grantSchedulerJobInvocation({ config, context, contract });
      await upsertScheduler({ key, config, context, contract, environment });
    }
  }

  const receipt = await writeJson(resolve(artifactRoot(contract, environment), `cloud-run-deployment-${phase}.json`), {
    schemaVersion: 1,
    kind: "gcp_cloud_run_deployment",
    status: "deployed",
    createdAt: new Date().toISOString(),
    environment,
    project: context.project,
    region: contract.region,
    gitSha,
    headGitSha,
    phase,
    imageManifest: resolve(manifestPath),
    secretManifest: resolve(secretManifestPath),
    urls,
    services: Object.fromEntries(Object.entries(contract.services).map(([key, value]) => [key, value.name])),
    jobs: Object.fromEntries(Object.entries(contract.jobs).map(([key, value]) => [key, value.name])),
    costGuard: Object.fromEntries(Object.entries(contract.services).map(([key, value]) => [key, { minInstances: value.minInstances, maxInstances: value.maxInstances, cpu: value.cpu, memory: value.memory }])),
    migrationExecuted: false
  });
  console.log(JSON.stringify({ ok: true, environment, project: context.project, phase, urls, receipt: receipt.path, migrationExecuted: false }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
  process.exitCode = 1;
});

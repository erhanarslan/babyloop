#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  policyHasMember,
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
  gcloudResourceExists,
  isGcloudNotFoundError,
  loadCloudRunContract,
  normalizeGcpLabelValue,
  parseFlag,
  run,
  safeMessage,
  serviceAccountEmail,
  validateDeploymentTopology,
  writeJson
} from "./cloud-run-lib.mjs";
import {
  stripCloudRunJobReservedEnv
} from "./cloud-run-job-env-lib.mjs";

const CLOUD_RUN_SERVICE_NAME = /^[a-z][a-z0-9-]{0,47}[a-z0-9]$/u;
const CLOUD_RUN_JOB_NAME = /^[a-z][a-z0-9-]{0,61}[a-z0-9]$/u;
const SCHEDULER_JOB_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,499}$/u;
const REGION_NAME = /^[a-z][a-z0-9-]{1,62}$/u;
const JOB_SCRIPT = /^dist\/scripts\/[a-z0-9-]+\.js$/u;
const READ_BACK_MAX_ATTEMPTS = 4;
const READ_BACK_DELAY_MS = 500;

async function withOperation(label, operation) {
  try {
    return await operation();
  } catch (error) {
    throw new Error(`${label} failed: ${safeMessage(error)}`, { cause: error });
  }
}

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

export function buildServiceDeployArgs({ config, role, image, environment, context, contract, envFile, secrets }) {
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
    `--labels=application=babyloop,environment=${environment},component=${normalizeGcpLabelValue(role)}`,
    config.public ? "--allow-unauthenticated" : "--no-allow-unauthenticated"
  ];
  if (role === "api") {
    args.push(`--env-vars-file=${envFile}`);
    if (secrets) args.push(`--set-secrets=${secrets}`);
  } else {
    args.push(`--set-env-vars=NODE_ENV=production,DEPLOY_ENVIRONMENT=${environment}`);
  }
  return args;
}

async function deployService(options) {
  const { config, context, contract } = options;
  await withOperation(
    `Cloud Run service ${config.name} deployment`,
    () => gcloud(buildServiceDeployArgs(options))
  );
  const result = await withOperation(
    `Cloud Run service ${config.name} URL resolution`,
    () => gcloud(buildServiceDescribeArgs(options), { capture: true })
  );
  return result.stdout.trim();
}

export function buildServiceDescribeArgs({ config, context, contract }) {
  return [
    "run", "services", "describe", config.name,
    `--region=${contract.region}`,
    `--project=${context.project}`,
    "--format=value(status.url)"
  ];
}

export function buildJobDeployArgs({ config, key, image, environment, context, contract, jobEnvFile, secrets, migrationEnvFile }) {
  return [
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
    `--labels=application=babyloop,environment=${environment},component=${normalizeGcpLabelValue(key)}`,
    `--env-vars-file=${key === "migrate" ? migrationEnvFile : jobEnvFile}`,
    ...(secrets ? [`--set-secrets=${secrets}`] : [])
  ];
}

async function deployJob(options) {
  await withOperation(
    `Cloud Run job ${options.config.name} deployment`,
    () => gcloud(buildJobDeployArgs(options))
  );
}

export async function schedulerExists(
  name,
  contract,
  project,
  execute = gcloud
) {
  return gcloudResourceExists(
    [
      "scheduler", "jobs", "describe", name,
      `--location=${contract.schedulerRegion}`,
      `--project=${project}`
    ],
    { execute, resource: `Cloud Scheduler job ${name}` }
  );
}

export function buildSchedulerJobIamArgs({
  config,
  context,
  contract
}) {
  const schedulerEmail = serviceAccountEmail(
    contract,
    "scheduler",
    context.project
  );
  return [
    "run",
    "jobs",
    "add-iam-policy-binding",
    config.name,
    `--region=${contract.region}`,
    `--project=${context.project}`,
    `--member=${schedulerMember(schedulerEmail)}`,
    `--role=${RUN_INVOKER_ROLE}`
  ];
}

async function grantSchedulerJobInvocation(options) {
  await withOperation(
    `Cloud Run job ${options.config.name} scheduler IAM binding`,
    () => gcloud(buildSchedulerJobIamArgs(options))
  );
}

export function schedulerJobName(config) {
  return `${config.name}-schedule`;
}

export function schedulerRunUri(project, region, jobName) {
  return `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/${jobName}:run`;
}

export function buildSchedulerArgs({
  verb,
  key,
  config,
  context,
  contract,
  environment
}) {
  if (!new Set(["create", "update"]).has(verb)) {
    throw new Error(`Unsupported Cloud Scheduler upsert verb: ${verb}`);
  }
  const name = schedulerJobName(config);
  const uri = schedulerRunUri(context.project, contract.region, config.name);
  return [
    "scheduler", "jobs", verb, "http", name,
    `--location=${contract.schedulerRegion}`,
    `--project=${context.project}`,
    `--schedule=${config.schedule}`,
    `--time-zone=${contract.timezone}`,
    `--uri=${uri}`,
    "--http-method=POST",
    `--oauth-service-account-email=${serviceAccountEmail(contract, "scheduler", context.project)}`,
    "--oauth-token-scope=https://www.googleapis.com/auth/cloud-platform",
    verb === "create"
      ? "--headers=Content-Type=application/json"
      : "--update-headers=Content-Type=application/json",
    "--message-body={}",
    "--attempt-deadline=320s",
    `--description=BabyLoop ${environment} ${key} Cloud Run Job trigger`
  ];
}

export function buildScheduledJobStatusArgs({
  config,
  context,
  contract
}) {
  return [
    "run", "jobs", "describe", config.name,
    `--region=${contract.region}`,
    `--project=${context.project}`,
    "--format=json(metadata.name,status.latestCreatedExecution)"
  ];
}

export function buildSchedulerDescribeArgs({
  config,
  context,
  contract
}) {
  return [
    "scheduler", "jobs", "describe", schedulerJobName(config),
    `--location=${contract.schedulerRegion}`,
    `--project=${context.project}`,
    "--format=json(name,state,schedule,timeZone,httpTarget.uri,httpTarget.httpMethod,httpTarget.oauthToken.serviceAccountEmail)"
  ];
}

export function buildScheduledJobIamPolicyArgs({
  config,
  context,
  contract
}) {
  return [
    "run", "jobs", "get-iam-policy", config.name,
    `--region=${contract.region}`,
    `--project=${context.project}`,
    "--format=json"
  ];
}

function parseGcloudJson(result, resource) {
  try {
    return JSON.parse(result.stdout || "null");
  } catch (error) {
    throw new Error(`${resource} returned malformed JSON: ${safeMessage(error)}`, { cause: error });
  }
}

class ExpectedReadBackMismatchError extends Error {}

function expectedReadBackMismatch(message) {
  return new ExpectedReadBackMismatchError(message);
}

async function defaultSleep(milliseconds) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function readBackWithBoundedRetry({
  label,
  read,
  sleep
}) {
  let lastError;
  for (let attempt = 1; attempt <= READ_BACK_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      const retryable = error instanceof ExpectedReadBackMismatchError
        || isGcloudNotFoundError(error);
      if (!retryable) {
        throw new Error(`${label} failed: ${safeMessage(error)}`, { cause: error });
      }
      lastError = error;
      if (attempt < READ_BACK_MAX_ATTEMPTS) {
        await sleep(READ_BACK_DELAY_MS);
      }
    }
  }
  throw new Error(
    `${label} did not converge after ${READ_BACK_MAX_ATTEMPTS} attempts: ${safeMessage(lastError)}`,
    { cause: lastError }
  );
}

function assertSchedulerReadBack({
  scheduler,
  schedulerName,
  schedulerEmail,
  expectedUri,
  config,
  contract
}) {
  if (
    scheduler?.name !== schedulerName
    && !String(scheduler?.name || "").endsWith(`/jobs/${schedulerName}`)
  ) {
    throw expectedReadBackMismatch(`Cloud Scheduler job ${schedulerName} returned an unexpected resource.`);
  }
  if (scheduler?.state !== "ENABLED") {
    throw expectedReadBackMismatch(`Cloud Scheduler job ${schedulerName} state verification expected ENABLED; found ${String(scheduler?.state || "missing")}.`);
  }
  if (scheduler?.schedule !== config.schedule) {
    throw expectedReadBackMismatch(`Cloud Scheduler job ${schedulerName} schedule verification failed.`);
  }
  if (scheduler?.timeZone !== contract.timezone) {
    throw expectedReadBackMismatch(`Cloud Scheduler job ${schedulerName} time zone verification failed.`);
  }
  if (scheduler?.httpTarget?.httpMethod !== "POST") {
    throw expectedReadBackMismatch(`Cloud Scheduler job ${schedulerName} HTTP method verification failed.`);
  }
  if (scheduler?.httpTarget?.uri !== expectedUri) {
    throw expectedReadBackMismatch(`Cloud Scheduler job ${schedulerName} URI verification failed.`);
  }
  if (scheduler?.httpTarget?.oauthToken?.serviceAccountEmail !== schedulerEmail) {
    throw expectedReadBackMismatch(`Cloud Scheduler job ${schedulerName} OAuth service account verification failed.`);
  }
}

export async function verifyScheduledJobInfrastructure(
  options,
  execute = gcloud,
  { sleep = defaultSleep } = {}
) {
  const { config, context, contract } = options;
  const schedulerName = schedulerJobName(config);
  const schedulerEmail = serviceAccountEmail(
    contract,
    "scheduler",
    context.project
  );
  const principal = schedulerMember(schedulerEmail);
  const expectedUri = schedulerRunUri(
    context.project,
    contract.region,
    config.name
  );

  const job = parseGcloudJson(
    await withOperation(
      `Cloud Run job ${config.name} infrastructure verification`,
      () => execute(buildScheduledJobStatusArgs(options), { capture: true })
    ),
    `Cloud Run job ${config.name}`
  );
  if (job?.metadata?.name !== config.name) {
    throw new Error(`Cloud Run job ${config.name} infrastructure verification returned an unexpected resource.`);
  }

  const scheduler = await readBackWithBoundedRetry({
    label: `Cloud Scheduler job ${schedulerName} infrastructure verification`,
    sleep,
    read: async () => {
      const value = parseGcloudJson(
        await execute(buildSchedulerDescribeArgs(options), { capture: true }),
        `Cloud Scheduler job ${schedulerName}`
      );
      assertSchedulerReadBack({
        scheduler: value,
        schedulerName,
        schedulerEmail,
        expectedUri,
        config,
        contract
      });
      return value;
    }
  });

  await readBackWithBoundedRetry({
    label: `Cloud Run job ${config.name} IAM verification`,
    sleep,
    read: async () => {
      const value = parseGcloudJson(
        await execute(buildScheduledJobIamPolicyArgs(options), { capture: true }),
        `Cloud Run job ${config.name} IAM policy`
      );
      if (!policyHasMember(value, RUN_INVOKER_ROLE, principal)) {
        throw expectedReadBackMismatch(`Cloud Run job ${config.name} is missing job-scoped ${RUN_INVOKER_ROLE} for ${principal}.`);
      }
      return value;
    }
  });

  const latestCreatedExecution = job.status?.latestCreatedExecution ?? null;
  const verifiedAt = (options.now ?? new Date()).toISOString();
  return {
    verifiedAt,
    job: {
      name: config.name,
      exists: true,
      executionObservation: latestCreatedExecution
        ? "execution_observed_during_deployment_verification"
        : "no_execution_observed_during_deployment_verification",
      latestCreatedExecution: latestCreatedExecution
        ? {
            name: latestCreatedExecution.name ?? null,
            completionStatus: latestCreatedExecution.completionStatus ?? null,
            creationTimestamp: latestCreatedExecution.creationTimestamp ?? null,
            completionTimestamp: latestCreatedExecution.completionTimestamp ?? null
          }
        : null
    },
    scheduler: {
      name: schedulerName,
      exists: true,
      state: scheduler.state,
      enabledVerified: true,
      schedule: scheduler.schedule,
      scheduleVerified: true,
      timeZone: scheduler.timeZone,
      timeZoneVerified: true,
      httpMethod: scheduler.httpTarget.httpMethod,
      httpMethodVerified: true,
      uri: scheduler.httpTarget.uri,
      uriVerified: true,
      oauthServiceAccountEmail: scheduler.httpTarget.oauthToken.serviceAccountEmail,
      oauthServiceAccountVerified: true
    },
    iam: {
      role: RUN_INVOKER_ROLE,
      member: principal,
      jobScoped: true,
      verified: true
    }
  };
}

async function upsertScheduler(options) {
  const { config, context, contract } = options;
  const name = schedulerJobName(config);
  const verb = await schedulerExists(name, contract, context.project)
    ? "update"
    : "create";
  await withOperation(
    `Cloud Scheduler job ${name} ${verb}`,
    () => gcloud(buildSchedulerArgs({ ...options, verb }))
  );
  return verifyScheduledJobInfrastructure(options);
}

function assertResourceName(value, pattern, label) {
  if (!pattern.test(String(value || ""))) {
    throw new Error(`${label} has an invalid resource name: ${String(value || "<empty>")}`);
  }
}

function assertPositiveInteger(value, label, { allowZero = false } = {}) {
  if (
    !Number.isInteger(value)
    || (allowZero ? value < 0 : value <= 0)
  ) {
    throw new Error(`${label} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
}

function assertResourceSize(value, label) {
  if (!/^\d+(?:Mi|Gi)$/u.test(String(value || ""))) {
    throw new Error(`${label} must use a Mi or Gi quantity.`);
  }
}

function assertDuration(value, label) {
  if (!/^\d+s$/u.test(String(value || ""))) {
    throw new Error(`${label} must be expressed in seconds.`);
  }
}

export function validateCloudRunDeploymentContract(contract, environment) {
  assertEnvironment(environment);
  validateDeploymentTopology(contract);
  if (!REGION_NAME.test(contract.region) || !REGION_NAME.test(contract.schedulerRegion)) {
    throw new Error("Cloud Run and Scheduler regions must be valid GCP region names.");
  }
  if (contract.region !== contract.schedulerRegion) {
    throw new Error("Cloud Scheduler region must match the Cloud Run Job region.");
  }
  if (!contract.projects?.[environment]) {
    throw new Error(`Cloud Run contract has no ${environment} project.`);
  }
  for (const role of ["api", "web", "backoffice", "jobs", "scheduler"]) {
    serviceAccountEmail(contract, role, contract.projects[environment]);
  }

  const labels = new Map();
  for (const [key, config] of Object.entries(contract.services)) {
    assertResourceName(config.name, CLOUD_RUN_SERVICE_NAME, `Cloud Run service ${key}`);
    if (config.image !== key) throw new Error(`Cloud Run service ${key} must use the ${key} image.`);
    if (typeof config.public !== "boolean") throw new Error(`Cloud Run service ${key} must declare public as a boolean.`);
    assertResourceSize(config.memory, `Cloud Run service ${key} memory`);
    assertPositiveInteger(config.concurrency, `Cloud Run service ${key} concurrency`);
    assertPositiveInteger(config.minInstances, `Cloud Run service ${key} minInstances`, { allowZero: true });
    assertPositiveInteger(config.maxInstances, `Cloud Run service ${key} maxInstances`);
    if (config.minInstances > config.maxInstances) throw new Error(`Cloud Run service ${key} minInstances exceeds maxInstances.`);
    assertDuration(config.timeout, `Cloud Run service ${key} timeout`);
    const label = normalizeGcpLabelValue(key, `Cloud Run service ${key} component label`);
    if (labels.has(label)) throw new Error(`Cloud Run component label collision: ${labels.get(label)} and ${key} normalize to ${label}.`);
    labels.set(label, key);
  }
  for (const [key, config] of Object.entries(contract.jobs)) {
    assertResourceName(config.name, CLOUD_RUN_JOB_NAME, `Cloud Run job ${key}`);
    if (!JOB_SCRIPT.test(String(config.script || ""))) throw new Error(`Cloud Run job ${key} has an invalid runtime script path.`);
    assertResourceSize(config.memory, `Cloud Run job ${key} memory`);
    assertDuration(config.timeout, `Cloud Run job ${key} timeout`);
    assertPositiveInteger(config.maxRetries, `Cloud Run job ${key} maxRetries`, { allowZero: true });
    if (config.maxRetries > 10) throw new Error(`Cloud Run job ${key} maxRetries exceeds 10.`);
    const label = normalizeGcpLabelValue(key, `Cloud Run job ${key} component label`);
    if (labels.has(label)) throw new Error(`Cloud Run component label collision: ${labels.get(label)} and ${key} normalize to ${label}.`);
    labels.set(label, key);
    if (config.schedule) {
      assertResourceName(schedulerJobName(config), SCHEDULER_JOB_NAME, `Cloud Scheduler job ${key}`);
      if (!String(contract.timezone || "").trim()) throw new Error("Cloud Scheduler timezone is required.");
    }
  }
  normalizeGcpLabelValue("babyloop", "application label");
  normalizeGcpLabelValue(environment, "environment label");
  return { componentLabels: Object.fromEntries(labels) };
}

export function deploymentPlan(contract, phase) {
  if (!new Set(["all", "migration", "services"]).has(phase)) {
    throw new Error("--phase must be all, migration, or services.");
  }
  return {
    services: phase === "migration" ? [] : Object.entries(contract.services),
    jobs: Object.entries(contract.jobs).filter(([key]) => {
      if (phase === "migration") return key === "migrate";
      if (phase === "services") return key !== "migrate";
      return true;
    })
  };
}

export async function executeDeploymentPlan({
  plan,
  deployServiceOperation,
  deployJobOperation,
  grantSchedulerOperation,
  upsertSchedulerOperation,
  onComplete
}) {
  const urls = {};
  const scheduledInfrastructure = {};
  for (const [key, config] of plan.services) {
    urls[key] = await deployServiceOperation(key, config);
  }
  for (const [key, config] of plan.jobs) {
    await deployJobOperation(key, config);
    if (config.schedule) {
      await grantSchedulerOperation(key, config);
      scheduledInfrastructure[key] = await upsertSchedulerOperation(key, config);
    }
  }
  return onComplete({ scheduledInfrastructure, urls });
}

export function buildCloudRunEnvSources(
  apiEnvSource,
  environment
) {
  const runtimeEnvSource = stripCloudRunJobReservedEnv(
    apiEnvSource
  );
  return {
    runtimeEnvSource,
    migrationEnvSource: `${runtimeEnvSource}MIGRATION_CONFIRM: ${JSON.stringify(
      `APPLY_${assertEnvironment(environment).toUpperCase()}`
    )}\n`
  };
}

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const phase = parseFlag("phase") || "all";
  const manifestPath = parseFlag("image-manifest") || resolve(artifactRoot((await loadCloudRunContract()).contract, environment), "cloud-run-image-manifest.json");
  const secretManifestPath = parseFlag("secret-manifest") || resolve(artifactRoot((await loadCloudRunContract()).contract, environment), "secret-manifest.json");
  const { contract, sha256 } = await loadCloudRunContract();
  validateCloudRunDeploymentContract(contract, environment);
  const plan = deploymentPlan(contract, phase);
  assertConfirmation("deploy", environment);
  const context = await assertGcloudContext(contract, environment, { mutation: true });
  const [images, secrets] = await Promise.all([readProtectedJson(manifestPath), readProtectedJson(secretManifestPath)]);
  if (images.environment !== environment || images.project !== context.project) throw new Error("Image manifest environment/project mismatch.");
  if (secrets.environment !== environment || secrets.project !== context.project) throw new Error("Secret manifest environment/project mismatch.");
  if (
    environment === "production"
    && (
      images.identifierContinuity?.verified !== true
      || secrets.identifierContinuity?.verified !== true
      || images.identifierContinuity.inventorySha256 !== secrets.identifierContinuity.inventorySha256
    )
  ) {
    throw new Error("Production build and runtime import must be bound to the same verified current runtime identifier inventory.");
  }
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
  const jobEnvFile = resolve(
    artifactRoot(contract, environment),
    "job-runtime.env.yaml"
  );
  const migrationEnvFile = resolve(
    artifactRoot(contract, environment),
    "migration-runtime.env.yaml"
  );
  const apiEnvSource = await readFile(envFile, "utf8");
  const {
    runtimeEnvSource,
    migrationEnvSource
  } = buildCloudRunEnvSources(apiEnvSource, environment);

  await Promise.all([
    writeFile(jobEnvFile, runtimeEnvSource, { mode: 0o600 }),
    writeFile(
      migrationEnvFile,
      migrationEnvSource,
      { mode: 0o600 }
    )
  ]);

  await executeDeploymentPlan({
    plan,
    deployServiceOperation: (role, config) => deployService({
      config,
      role,
      image: images.images[config.image],
      environment,
      context,
      contract,
      envFile: jobEnvFile,
      secrets: role === "api" ? secretBindings : ""
    }),
    deployJobOperation: (key, config) => deployJob({
      config,
      key,
      image: images.images.api,
      environment,
      context,
      contract,
      jobEnvFile,
      secrets: secretBindings,
      migrationEnvFile
    }),
    grantSchedulerOperation: (_key, config) => grantSchedulerJobInvocation({ config, context, contract }),
    upsertSchedulerOperation: (key, config) => upsertScheduler({ key, config, context, contract, environment }),
    onComplete: async ({ scheduledInfrastructure, urls }) => {
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
        scheduledInfrastructure,
        costGuard: Object.fromEntries(Object.entries(contract.services).map(([key, value]) => [key, { minInstances: value.minInstances, maxInstances: value.maxInstances, cpu: value.cpu, memory: value.memory }])),
        migrationExecuted: false
      });
      console.log(JSON.stringify({ ok: true, environment, project: context.project, phase, urls, receipt: receipt.path, migrationExecuted: false }, null, 2));
      return receipt;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
    process.exitCode = 1;
  });
}

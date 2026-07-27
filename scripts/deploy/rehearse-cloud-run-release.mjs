#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { auditRuntimeEnv } from "./runtime-env-lib.mjs";
import { timestampForFile, writeJsonReceipt } from "./deployment-lib.mjs";
import {
  buildTrafficRollbackArgs,
  createReadOnlyGcloudExecutor,
  initialServiceBootstrapPolicy,
  normalizeHttpsOrigin,
  RELEASE_STAGES,
  requirePublicSurfaces,
  resolveSmokeTargets,
  runReleaseStageChecks,
  summarizeGcloudCommandAudit
} from "./release-orchestration-lib.mjs";
import {
  buildJobDeployArgs,
  buildScheduledJobIamPolicyArgs,
  buildScheduledJobStatusArgs,
  buildSchedulerArgs,
  buildSchedulerDescribeArgs,
  buildSchedulerJobIamArgs,
  buildServiceDeployArgs,
  buildServiceDescribeArgs,
  schedulerJobName,
  schedulerRunUri,
  validateCloudRunDeploymentContract
} from "../gcp/deploy-cloud-run.mjs";
import { buildMigrationExecutionArgs } from "../gcp/execute-cloud-run-migration.mjs";
import {
  assertEnvironment,
  isGcloudNotFoundError,
  loadCloudRunContract,
  parseFlag,
  run,
  safeMessage,
  secretId,
  serviceAccountEmail
} from "../gcp/cloud-run-lib.mjs";
import { selectRollbackTraffic } from "./capture-cloud-run-rollback.mjs";
import {
  policyHasMember,
  RUN_INVOKER_ROLE,
  schedulerMember
} from "../gcp/cloud-run-iam-lib.mjs";

const REQUIRED_FILES = Object.freeze([
  ".github/workflows/deploy-staging.yml",
  ".github/workflows/promote-production.yml",
  "deploy/gcp/cloud-run.contract.json",
  "deploy/gcp/deployment-smoke-routes.json",
  "deploy/env/runtime-env.contract.json",
  "deploy/docker/Dockerfile",
  "scripts/deploy/deployment-smoke-contract.mjs",
  "scripts/deploy/post-deploy-smoke.mjs",
  "scripts/deploy/resolve-release-contract.mjs",
  "scripts/deploy/record-release-metadata.mjs",
  "scripts/deploy/write-release-summary.mjs",
  "scripts/deploy/capture-cloud-run-rollback.mjs",
  "scripts/deploy/rollback-cloud-run-release.mjs"
]);

const WORKFLOW_CONTRACTS = Object.freeze({
  staging: {
    path: ".github/workflows/deploy-staging.yml",
    orderedSteps: [
      "Materialize protected runtime contract",
      "Audit runtime contract",
      "Staging release rehearsal preflight",
      "Import pinned Secret Manager versions",
      "Build immutable Artifact Registry images",
      "Capture previous Cloud Run revisions",
      "Database preflight",
      "Verified pre-migration backup",
      "Deploy migration job only",
      "Execute migration",
      "Database postflight",
      "Deploy services and workers",
      "Resolve release contract",
      "Staging smoke",
      "Record immutable deployment metadata"
    ]
  },
  production: {
    path: ".github/workflows/promote-production.yml",
    orderedSteps: [
      "Resolve verified staging SHA",
      "Materialize protected runtime contract",
      "Audit runtime contract",
      "Production release rehearsal preflight",
      "Import pinned Secret Manager versions",
      "Promote exact staging image digests",
      "Capture previous Cloud Run revisions",
      "Production database preflight",
      "Mandatory encrypted backup",
      "Deploy migration job only",
      "Execute production migration",
      "Production database postflight",
      "Deploy production services and workers",
      "Resolve release contract",
      "Production smoke",
      "Record immutable deployment metadata"
    ]
  }
});

export async function rehearseCloudRunRelease(options = {}) {
  const environment = assertEnvironment(options.environment || "staging");
  const envFile = resolve(options.envFile || `deploy/env/${environment}.env.example`);
  const liveReadOnly = options.liveReadOnly === true;
  const { contract, sha256: contractSha256 } = options.cloudRunContract
    ? { contract: options.cloudRunContract, sha256: options.cloudRunContractSha256 }
    : await loadCloudRunContract();
  const audit = await captureAudit(envFile, environment, options.allowExample === true || envFile.endsWith(".example"));
  const workflowContract = WORKFLOW_CONTRACTS[environment];
  const workflow = await readFile(workflowContract.path, "utf8");
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const context = { project: contract.projects[environment] };
  const fixtureImage = `europe-west1-docker.pkg.dev/${context.project}/${contract.repository}/babyloop-api@sha256:${"a".repeat(64)}`;
  const fixtureSecrets = "DATABASE_URL=babyloop-database-url:1";
  const commandInventory = buildCommandInventory({
    audit,
    contract,
    context,
    environment,
    envFile,
    fixtureImage,
    fixtureSecrets
  });
  const auditedExecutor = createReadOnlyGcloudExecutor(
    options.execute || ((args, commandOptions) => run("gcloud", args, commandOptions))
  );
  const live = liveReadOnly
    ? await runLiveReadOnlyChecks({
        audit,
        contract,
        context,
        environment,
        envFile,
        execute: auditedExecutor.execute,
        fetchImpl: options.fetchImpl || fetch,
        initialBootstrapConfirmation: options.initialBootstrapConfirmation
          ?? process.env.GCP_INITIAL_SERVICE_BOOTSTRAP_CONFIRM
      })
    : {
        blockers: [],
        warnings: [],
        unverified: ["Live GCP, DNS, TLS, IAM, and rollback resource checks were not requested."],
        publicSurfaceErrors: [],
        rollbackErrors: [],
        commandCompatibility: false,
        databasePreflightVerified: false,
        databasePreflight: {
          accessMode: "read_only",
          executed: false,
          verified: false
        }
      };
  const commandAudit = summarizeGcloudCommandAudit(auditedExecutor.audit);
  const commonStaticCheck = async () => {
    await Promise.all(REQUIRED_FILES.map((file) => access(file)));
    validateCloudRunDeploymentContract(contract, environment);
    assertWorkflowOrder(workflow, environment);
    assertWorkflowActions(workflow, environment);
    assertPackageScripts(workflow, packageJson.scripts || {}, environment);
    if (commandAudit.mutationCommandsExecuted) throw new Error("Rehearsal executed a mutation command.");
    assertEveryCommand(commandInventory.servicesDescribe, ["run", "services", "describe"]);
    assertEveryCommand(commandInventory.jobsDescribe, ["run", "jobs", "describe"]);
    assertEveryCommand(commandInventory.iamDescribe, ["run", "jobs", "get-iam-policy"]);
    assertEveryCommand(commandInventory.schedulerDescribe, ["scheduler", "jobs", "describe"]);
    return { warnings: live.warnings };
  };

  const checks = Object.fromEntries(RELEASE_STAGES.map((stage) => [stage, commonStaticCheck]));
  checks["runtime-audit"] = async () => {
    await commonStaticCheck();
    if (!audit.ok) throw new Error(audit.error);
    return { warnings: audit.warnings };
  };
  checks["secret-import-plan"] = async () => {
    if (commandInventory.secretIds.length !== audit.secretNames.length) {
      throw new Error("Secret import plan does not cover every audited secret name.");
    }
    return {
      unverifiedMutationOnly: "Secret creation/version upload and runtime IAM changes are verified only during the confirmed import step."
    };
  };
  checks["image-manifest"] = async () => ({
    unverifiedMutationOnly: "Image digest and vulnerability outputs do not exist until the immutable build completes."
  });
  checks["database-preflight"] = async () => live.databasePreflightVerified
    ? {}
    : { warnings: ["Protected database read-only preflight was not requested in local static mode."] };
  checks["backup-receipt"] = async () => ({
    unverifiedMutationOnly: "Encrypted dump bytes and their checksum can only be verified after pg_dump writes the backup."
  });
  checks["migration-job-deploy"] = async () => assertCommand(commandInventory.migrationJobDeploy, ["run", "jobs", "deploy"]);
  checks["migration-execute"] = async () => ({
    ...assertCommand(commandInventory.migrationExecute, ["run", "jobs", "execute"]),
    unverifiedMutationOnly: "Migration execution outcome is mutation-only and is not run by rehearsal."
  });
  checks["database-postflight"] = async () => ({
    unverifiedMutationOnly: "Post-migration journal and schema checks require the migration result."
  });
  checks["services-deploy"] = async () => assertEveryCommand(commandInventory.servicesDeploy, ["run", "deploy"]);
  checks["jobs-deploy"] = async () => assertEveryCommand(commandInventory.jobsDeploy, ["run", "jobs", "deploy"]);
  checks["job-scoped-iam"] = async () => assertEveryCommand(commandInventory.iamBindings, ["run", "jobs", "add-iam-policy-binding"]);
  checks["scheduler-create"] = async () => {
    assertEveryCommand(commandInventory.schedulerCreate, ["scheduler", "jobs", "create", "http"]);
    if (!commandInventory.schedulerCreate.every((args) => args.includes("--headers=Content-Type=application/json"))) {
      throw new Error("Scheduler create command must use --headers.");
    }
    return commandCompatibilityResult(liveReadOnly, live.commandCompatibility);
  };
  checks["scheduler-update"] = async () => {
    assertEveryCommand(commandInventory.schedulerUpdate, ["scheduler", "jobs", "update", "http"]);
    if (!commandInventory.schedulerUpdate.every((args) => args.includes("--update-headers=Content-Type=application/json"))) {
      throw new Error("Scheduler update command must use --update-headers.");
    }
    return commandCompatibilityResult(liveReadOnly, live.commandCompatibility);
  };
  checks["resolved-release-contract"] = async () => ({
    unverifiedMutationOnly: "The checksum-protected resolved contract requires deployment, migration, backup, and service URL read-back receipts."
  });
  checks["deployment-smoke"] = async () => {
    const targets = resolveSmokeTargets({
      environment,
      deploymentReceipt: syntheticDeploymentReceipt(environment, context.project),
      canonicalPublicUrls: canonicalUrls(audit.values),
      requirePublicSurfaces: audit.values.DEPLOY_REQUIRE_PUBLIC_SURFACES
    });
    if (environment === "production" && targets.policy.publicRequired !== true) {
      throw new Error("Production rehearsal must require public surfaces.");
    }
    return { unverifiedMutationOnly: "Exact deployed URLs do not exist until the services receipt is written." };
  };
  checks["public-surface-smoke"] = async () => {
    const required = requirePublicSurfaces(environment, audit.values.DEPLOY_REQUIRE_PUBLIC_SURFACES);
    for (const value of Object.values(canonicalUrls(audit.values))) normalizeHttpsOrigin(value, "canonical surface");
    if (live.publicSurfaceErrors.length > 0 && required) {
      throw new Error(live.publicSurfaceErrors.join("; "));
    }
    return { warnings: required ? [] : live.publicSurfaceErrors };
  };
  checks["deployment-metadata"] = async () => assertWorkflowToken(workflow, "deploy:release-metadata");
  checks["artifact-inventory"] = async () => {
    for (const token of [".release", "if-no-files-found: error", "include-hidden-files: true"]) {
      assertWorkflowToken(workflow, token);
    }
    return {};
  };
  checks.rollback = async () => {
    assertEveryCommand(commandInventory.rollback, ["run", "services", "update-traffic"]);
    if (live.rollbackErrors.length > 0) throw new Error(live.rollbackErrors.join("; "));
    return liveReadOnly ? {} : {
      unverifiedMutationOnly: "Previous revision availability requires live read-only service descriptions."
    };
  };
  checks["deployment-summary"] = async () => assertWorkflowToken(workflow, "scripts/deploy/write-release-summary.mjs");

  const result = await runReleaseStageChecks(checks);
  result.blockers.push(...live.blockers);
  result.ok = result.blockers.length === 0;
  result.warnings.push(...live.warnings.filter((warning) => !result.warnings.includes(warning)));
  result.unverifiedMutationOnly.push(...live.unverified);
  return {
    result,
    evidence: {
      schemaVersion: 1,
      kind: "cloud_run_release_rehearsal",
      status: result.ok
        ? result.warnings.length > 0 ? "passed_with_warnings" : "passed"
        : "blocked",
      createdAt: new Date().toISOString(),
      environment,
      cloudRunContractSha256: contractSha256,
      liveReadOnly,
      workflowPath: workflowContract.path,
      smokePolicy: {
        requirePublicSurfaces: requirePublicSurfaces(environment, audit.values.DEPLOY_REQUIRE_PUBLIC_SURFACES),
        workerBootstrapGraceSeconds: environment === "staging" ? 360 : 0
      },
      databasePreflight: live.databasePreflight,
      commandAudit,
      mutationCommandsExecuted: commandAudit.mutationCommandsExecuted,
      executedReadOnlyCommandCount: commandAudit.executedReadOnlyCommandCount,
      rejectedMutationCommandCount: commandAudit.rejectedMutationCommandCount,
      commandInventory: summarizeCommandInventory(commandInventory),
      ...result
    }
  };
}

function buildCommandInventory({ audit, contract, context, environment, envFile, fixtureImage, fixtureSecrets }) {
  const common = { context, contract, environment };
  const servicesDeploy = Object.entries(contract.services).map(([role, config]) => buildServiceDeployArgs({
    ...common,
    role,
    config,
    image: fixtureImage.replace("babyloop-api", `babyloop-${config.image}`),
    envFile,
    secrets: role === "api" ? fixtureSecrets : ""
  }));
  const jobsDeploy = Object.entries(contract.jobs).map(([key, config]) => buildJobDeployArgs({
    ...common,
    key,
    config,
    image: fixtureImage,
    jobEnvFile: "/runtime/job.env.yaml",
    migrationEnvFile: "/runtime/migration.env.yaml",
    secrets: fixtureSecrets
  }));
  const scheduled = Object.entries(contract.jobs).filter(([, config]) => config.schedule);
  return {
    secretIds: audit.secretNames.map((key) => secretId(contract, key)),
    servicesDeploy,
    servicesDescribe: Object.values(contract.services).map((config) => buildServiceDescribeArgs({ config, context, contract })),
    jobsDeploy,
    jobsDescribe: Object.values(contract.jobs).map((config) => buildScheduledJobStatusArgs({ config, context, contract })),
    migrationJobDeploy: jobsDeploy.find((args) => args.includes(contract.jobs.migrate.name)),
    migrationExecute: buildMigrationExecutionArgs({ contract, context }),
    iamBindings: scheduled.map(([, config]) => buildSchedulerJobIamArgs({ config, context, contract })),
    iamDescribe: scheduled.map(([, config]) => buildScheduledJobIamPolicyArgs({ config, context, contract })),
    schedulerCreate: scheduled.map(([key, config]) => buildSchedulerArgs({ verb: "create", key, config, ...common })),
    schedulerUpdate: scheduled.map(([key, config]) => buildSchedulerArgs({ verb: "update", key, config, ...common })),
    schedulerDescribe: scheduled.map(([, config]) => buildSchedulerDescribeArgs({ config, context, contract })),
    rollback: Object.values(contract.services).map((config) => buildTrafficRollbackArgs({
      service: config.name,
      traffic: [{ revisionName: `${config.name}-00001-abc`, percent: 100 }],
      project: context.project,
      region: contract.region
    }))
  };
}

async function runLiveReadOnlyChecks({
  audit,
  contract,
  context,
  environment,
  envFile,
  execute,
  fetchImpl,
  initialBootstrapConfirmation
}) {
  const command = execute;
  const blockers = [];
  const warnings = [];
  const unverified = ["Service-account actAs and mutation success remain unverified without performing a mutation."];
  const publicSurfaceErrors = [];
  const rollbackErrors = [];
  let commandCompatibility = false;
  let databasePreflightVerified = false;
  let databasePreflight = {
    accessMode: "read_only",
    executed: false,
    verified: false
  };

  try {
    const auth = await command(["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"], { capture: true });
    if (!auth.stdout.trim()) throw new Error("gcloud has no active identity.");
  } catch (error) {
    blockers.push(`live-gcloud-auth: ${safeMessage(error)}`);
  }
  try {
    const project = await command(["config", "get-value", "project"], { capture: true });
    if (project.stdout.trim() !== context.project) throw new Error(`gcloud project must be ${context.project}.`);
  } catch (error) {
    blockers.push(`live-gcloud-project: ${safeMessage(error)}`);
  }
  try {
    const enabled = await command(["services", "list", "--enabled", "--format=value(config.name)", `--project=${context.project}`], { capture: true });
    const names = new Set(enabled.stdout.split(/\r?\n/u).filter(Boolean));
    const missing = contract.requiredApis.filter((api) => !names.has(api));
    if (missing.length > 0) throw new Error(`required APIs are disabled: ${missing.join(", ")}`);
  } catch (error) {
    blockers.push(`live-required-apis: ${safeMessage(error)}`);
  }
  try {
    await command([
      "artifacts", "repositories", "describe", contract.repository,
      `--location=${contract.region}`,
      `--project=${context.project}`,
      "--format=json(name,format)"
    ], { capture: true });
  } catch (error) {
    blockers.push(`live-artifact-registry: ${safeMessage(error)}`);
  }
  if (envFile.endsWith(".example")) {
    warnings.push("Protected database preflight was skipped because rehearsal uses a safe example env file.");
    databasePreflight = {
      ...databasePreflight,
      reason: "safe_example_environment"
    };
  } else {
    try {
      await run(
        process.execPath,
        [`--env-file=${envFile}`, "scripts/ops/database-release-safety.mjs", "--phase=preflight"],
        {
          capture: true,
          env: {
            ...process.env,
            DATABASE_RELEASE_EVIDENCE_PATH: resolve(
              `.release/gcp/${environment}/rehearsal-database-preflight.json`
            )
          }
        }
      );
      databasePreflightVerified = true;
      databasePreflight = {
        accessMode: "read_only",
        executed: true,
        verified: true,
        enforcement: "postgres_default_transaction_read_only"
      };
    } catch (error) {
      blockers.push(`live-database-preflight: ${safeMessage(error)}`);
    }
  }
  for (const role of Object.keys(contract.serviceAccounts)) {
    const email = serviceAccountEmail(contract, role, context.project);
    try {
      await command(["iam", "service-accounts", "describe", email, `--project=${context.project}`, "--format=value(email)"], { capture: true });
    } catch (error) {
      blockers.push(`live-service-account-${role}: ${safeMessage(error)}`);
    }
  }
  for (const key of audit.secretNames) {
    const id = secretId(contract, key);
    try {
      await command(["secrets", "describe", id, `--project=${context.project}`, "--format=value(name)"], { capture: true });
      await command([
        "secrets", "versions", "list", id,
        `--project=${context.project}`,
        "--filter=state:ENABLED",
        "--limit=1",
        "--format=value(name)"
      ], { capture: true });
    } catch (error) {
      const message = safeMessage(error);
      if (/NOT_FOUND|404/iu.test(message)) unverified.push(`Secret ${id} will be created by the confirmed import step.`);
      else blockers.push(`live-secret-${id}: ${message}`);
    }
  }
  for (const [key, config] of Object.entries(contract.services)) {
    let description;
    try {
      const result = await command([
        "run", "services", "describe", config.name,
        `--project=${context.project}`,
        `--region=${contract.region}`,
        "--format=json(metadata.name,status.url,status.traffic)"
      ], { capture: true });
      description = JSON.parse(result.stdout || "null");
      selectRollbackTraffic(description, config.name);
      if (!description?.status?.url) throw new Error("service has no exact URL");
    } catch (error) {
      if (isGcloudNotFoundError(error)) {
        const policy = initialServiceBootstrapPolicy(
          environment,
          initialBootstrapConfirmation
        );
        if (!policy.allowed) {
          rollbackErrors.push(
            `${key}: service is absent; GCP_INITIAL_SERVICE_BOOTSTRAP_CONFIRM=${policy.expectedConfirmation} is required`
          );
        } else {
          unverified.push(`${key}: initial service bootstrap observed; there is no restorable prior traffic snapshot.`);
        }
      } else {
        rollbackErrors.push(`${key}: ${safeMessage(error)}`);
      }
      continue;
    }
    try {
      const probeUrl = key === "api"
        ? `${description.status.url}/health/live`
        : key === "backoffice"
          ? `${description.status.url}/login`
          : description.status.url;
      const response = await fetchImpl(probeUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(8000)
      });
      if (config.public === true && new Set([401, 403]).has(response.status)) {
        throw new Error(`public IAM contract returned HTTP ${response.status}`);
      }
      if (!response.ok) throw new Error(`exact service URL returned HTTP ${response.status}`);
    } catch (error) {
      warnings.push(`Current Cloud Run service ${key} HTTP reachability warning: ${safeMessage(error)}`);
    }
  }
  for (const [key, config] of Object.entries(contract.jobs).filter(([, value]) => value.schedule)) {
    try {
      const result = await command(["run", "jobs", "get-iam-policy", config.name, `--project=${context.project}`, `--region=${contract.region}`, "--format=json"], { capture: true });
      const policy = JSON.parse(result.stdout || "null");
      const schedulerEmail = serviceAccountEmail(contract, "scheduler", context.project);
      if (!policyHasMember(policy, RUN_INVOKER_ROLE, schedulerMember(schedulerEmail))) {
        warnings.push(`Scheduled job ${key} is missing the expected job-scoped invoker binding; deploy will add it.`);
      }
    } catch (error) {
      if (/NOT_FOUND|404/iu.test(safeMessage(error))) unverified.push(`Scheduled job ${key} does not yet exist and will be deployed.`);
      else blockers.push(`live-job-iam-${key}: ${safeMessage(error)}`);
    }
    try {
      const result = await command(["scheduler", "jobs", "describe", schedulerJobName(config), `--project=${context.project}`, `--location=${contract.schedulerRegion}`, "--format=json"], { capture: true });
      const scheduler = JSON.parse(result.stdout || "null");
      const schedulerEmail = serviceAccountEmail(contract, "scheduler", context.project);
      const expectedUri = schedulerRunUri(context.project, contract.region, config.name);
      if (
        scheduler?.state !== "ENABLED"
        || scheduler?.schedule !== config.schedule
        || scheduler?.timeZone !== contract.timezone
        || scheduler?.httpTarget?.httpMethod !== "POST"
        || scheduler?.httpTarget?.uri !== expectedUri
        || scheduler?.httpTarget?.oauthToken?.serviceAccountEmail !== schedulerEmail
      ) {
        warnings.push(`Scheduler ${key} has stale fields; the confirmed deploy will update and read back the exact contract.`);
      }
    } catch (error) {
      if (/NOT_FOUND|404/iu.test(safeMessage(error))) unverified.push(`Scheduler ${key} will take the create path.`);
      else blockers.push(`live-scheduler-${key}: ${safeMessage(error)}`);
    }
  }
  try {
    await verifyGcloudHelp(command);
    commandCompatibility = true;
  } catch (error) {
    blockers.push(`gcloud-command-compatibility: ${safeMessage(error)}`);
  }
  for (const [key, origin] of Object.entries(canonicalUrls(audit.values))) {
    try {
      const response = await fetchImpl(origin, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      publicSurfaceErrors.push(`${key} ${normalizeSafeLiveError(origin, error)}`);
    }
  }
  return {
    blockers,
    warnings,
    unverified,
    publicSurfaceErrors,
    rollbackErrors,
    commandCompatibility,
    databasePreflightVerified,
    databasePreflight
  };
}

async function verifyGcloudHelp(execute) {
  for (const [args, flag] of [
    [["scheduler", "jobs", "create", "http", "--help"], "--headers"],
    [["scheduler", "jobs", "update", "http", "--help"], "--update-headers"],
    [["run", "deploy", "--help"], "--allow-unauthenticated"],
    [["run", "jobs", "deploy", "--help"], "--task-timeout"],
    [["run", "jobs", "add-iam-policy-binding", "--help"], "--member"],
    [["run", "services", "update-traffic", "--help"], "--to-revisions"]
  ]) {
    const result = await execute(args, { capture: true });
    if (!`${result.stdout}\n${result.stderr}`.includes(flag)) throw new Error(`gcloud ${args.slice(0, -1).join(" ")} help is missing ${flag}.`);
  }
}

function assertWorkflowOrder(source, environment) {
  const tokens = WORKFLOW_CONTRACTS[environment].orderedSteps;
  let cursor = -1;
  for (const token of tokens) {
    const index = source.indexOf(token, cursor + 1);
    if (index < 0) throw new Error(`Workflow step is missing or out of order: ${token}.`);
    cursor = index;
  }
  if (environment === "production") {
    for (const token of [
      "RELEASE_SOURCE_GIT_SHA=$source_sha",
      '--source-environment=staging --git-sha="${{ steps.source.outputs.sha }}"',
      "scripts/deploy/write-release-summary.mjs"
    ]) assertWorkflowToken(source, token);
  }
}

function assertWorkflowActions(source, environment) {
  for (const token of [
    "actions/checkout@v4",
    "pnpm/action-setup@v4",
    "actions/setup-node@v4",
    "google-github-actions/auth@v3",
    "google-github-actions/setup-gcloud@v3",
    "actions/upload-artifact@v4"
  ]) assertWorkflowToken(source, token);
  if (environment === "staging") assertWorkflowToken(source, "docker/setup-buildx-action@v4");
  if (!source.includes("runs-on: ubuntu-latest")) throw new Error(`${environment} workflow runner is not pinned to ubuntu-latest.`);
}

function assertPackageScripts(workflow, scripts, environment) {
  const matches = workflow.matchAll(/pnpm ([a-z0-9:-]+)/gu);
  for (const match of matches) {
    if (match[1] === "install") continue;
    if (!scripts[match[1]]) throw new Error(`Workflow references missing package script ${match[1]}.`);
  }
  for (const name of [
    `deploy:rehearse:${environment}`,
    "deploy:smoke",
    "gcp:cloud-run:deploy",
    "gcp:cloud-run:migrate"
  ]) {
    if (!scripts[name]) throw new Error(`package.json is missing ${name}.`);
  }
}

function assertCommand(args, prefix) {
  if (!prefix.every((value, index) => args?.[index] === value)) {
    throw new Error(`Command does not start with ${prefix.join(" ")}.`);
  }
  return {};
}

function assertEveryCommand(commands, prefix) {
  if (!commands.length) throw new Error(`No ${prefix.join(" ")} commands were generated.`);
  for (const args of commands) assertCommand(args, prefix);
  return {};
}

function assertWorkflowToken(source, token) {
  if (!source.includes(token)) throw new Error(`Workflow is missing ${token}.`);
  return {};
}

function commandCompatibilityResult(liveReadOnly, verified) {
  return verified ? {} : {
    unverifiedMutationOnly: liveReadOnly
      ? "Installed gcloud command help could not be verified."
      : "Installed gcloud help was not requested; pure builders were verified."
  };
}

function canonicalUrls(values) {
  return {
    api: values.NEXT_PUBLIC_API_BASE_URL,
    web: values.NEXT_PUBLIC_SITE_URL,
    backoffice: values.NEXT_PUBLIC_BACKOFFICE_BASE_URL
  };
}

function syntheticDeploymentReceipt(environment, project) {
  return {
    kind: "gcp_cloud_run_deployment",
    status: "deployed",
    environment,
    project,
    phase: "services",
    urls: {
      api: "https://api-deployment.example.test",
      web: "https://web-deployment.example.test",
      backoffice: "https://backoffice-deployment.example.test"
    }
  };
}

async function captureAudit(envFile, environment, allowExample) {
  try {
    const audit = await auditRuntimeEnv({
      envFile,
      target: environment,
      allowExample,
      allowInsecurePermissions: allowExample
    });
    return { ...audit, ok: true };
  } catch (error) {
    return {
      ok: false,
      error: safeMessage(error),
      warnings: [],
      secretNames: [],
      values: {}
    };
  }
}

function summarizeCommandInventory(inventory) {
  return {
    serviceDeploy: inventory.servicesDeploy.length,
    serviceDescribe: inventory.servicesDescribe.length,
    jobDeploy: inventory.jobsDeploy.length,
    jobDescribe: inventory.jobsDescribe.length,
    jobScopedIam: inventory.iamBindings.length,
    schedulerCreate: inventory.schedulerCreate.length,
    schedulerUpdate: inventory.schedulerUpdate.length,
    schedulerDescribe: inventory.schedulerDescribe.length,
    rollback: inventory.rollback.length,
    businessWorkerExecute: 0
  };
}

function normalizeSafeLiveError(origin, error) {
  const code = error?.cause?.code || error?.code || "unknown";
  return `origin=${new URL(origin).origin} code=${String(code)}`;
}

async function main() {
  const environment = assertEnvironment(parseFlag("environment") || "staging");
  const result = await rehearseCloudRunRelease({
    environment,
    envFile: parseFlag("env-file") || undefined,
    liveReadOnly: parseFlag("live-read-only") === "true"
  });
  const outputPath = resolve(
    parseFlag("output")
      || `.release/evidence/${environment}-release-rehearsal-${timestampForFile()}.json`
  );
  const receipt = await writeJsonReceipt(outputPath, result.evidence);
  process.stdout.write(`${JSON.stringify({
    ...result.result,
    receiptPath: receipt.path,
    checksum: receipt.checksum
  }, null, 2)}\n`);
  if (!result.result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: safeMessage(error) })}\n`);
    process.exitCode = 1;
  });
}

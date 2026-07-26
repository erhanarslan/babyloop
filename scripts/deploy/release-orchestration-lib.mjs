import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";

export const RELEASE_CONTRACT_SCHEMA_VERSION = 1;

export const RELEASE_STAGES = Object.freeze([
  "runtime-audit",
  "secret-import-plan",
  "image-manifest",
  "database-preflight",
  "backup-receipt",
  "migration-job-deploy",
  "migration-execute",
  "database-postflight",
  "services-deploy",
  "jobs-deploy",
  "job-scoped-iam",
  "scheduler-create",
  "scheduler-update",
  "resolved-release-contract",
  "deployment-smoke",
  "public-surface-smoke",
  "deployment-metadata",
  "artifact-inventory",
  "rollback",
  "deployment-summary"
]);

const REQUIRED_SERVICE_KEYS = Object.freeze(["api", "web", "backoffice"]);
const READ_ONLY_GCLOUD_PATHS = Object.freeze([
  ["auth", "list"],
  ["config", "get-value"],
  ["services", "list"],
  ["artifacts", "repositories", "describe"],
  ["iam", "service-accounts", "describe"],
  ["secrets", "describe"],
  ["secrets", "versions", "list"],
  ["run", "services", "describe"],
  ["run", "jobs", "describe"],
  ["run", "jobs", "get-iam-policy"],
  ["scheduler", "jobs", "describe"],
  ["projects", "describe"],
  ["billing", "projects", "describe"]
]);
const READ_ONLY_GCLOUD_HELP_PATHS = Object.freeze([
  ["scheduler", "jobs", "create", "http"],
  ["scheduler", "jobs", "update", "http"],
  ["run", "deploy"],
  ["run", "jobs", "deploy"],
  ["run", "jobs", "add-iam-policy-binding"],
  ["run", "services", "update-traffic"]
]);
const MUTATION_VERBS = new Set([
  "add",
  "add-iam-policy-binding",
  "create",
  "delete",
  "disable",
  "deploy",
  "enable",
  "execute",
  "import",
  "pause",
  "remove-iam-policy-binding",
  "replace",
  "resume",
  "set",
  "set-iam-policy",
  "update",
  "update-traffic"
]);
const NETWORK_CODES = Object.freeze({
  ENOTFOUND: "dns_not_found",
  EAI_AGAIN: "dns_temporary_failure",
  ECONNREFUSED: "connection_refused",
  ECONNRESET: "connection_reset",
  ETIMEDOUT: "connect_timeout",
  UND_ERR_CONNECT_TIMEOUT: "connect_timeout",
  UND_ERR_HEADERS_TIMEOUT: "request_timeout",
  UND_ERR_BODY_TIMEOUT: "request_timeout",
  CERT_HAS_EXPIRED: "tls_certificate_expired",
  ERR_TLS_CERT_ALTNAME_INVALID: "tls_hostname_mismatch",
  DEPTH_ZERO_SELF_SIGNED_CERT: "tls_unknown_ca",
  SELF_SIGNED_CERT_IN_CHAIN: "tls_unknown_ca",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "tls_unknown_ca",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "tls_unknown_ca",
  ERR_FR_TOO_MANY_REDIRECTS: "redirect_loop"
});

export function normalizeHttpsOrigin(value, label) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} uses an unsupported protocol; HTTPS is required.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain URL credentials.`);
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${label} must be an origin without a path, query, or fragment.`);
  }
  return parsed.origin;
}

export function requirePublicSurfaces(environment, configuredValue) {
  const normalizedEnvironment = String(environment || "").trim().toLowerCase();
  if (!new Set(["staging", "production"]).has(normalizedEnvironment)) {
    throw new Error("Smoke environment must be staging or production.");
  }
  const value = String(configuredValue ?? "").trim().toLowerCase();
  if (value && !new Set(["true", "false", "1", "0", "yes", "no"]).has(value)) {
    throw new Error("DEPLOY_REQUIRE_PUBLIC_SURFACES must be true or false.");
  }
  const requested = new Set(["true", "1", "yes"]).has(value);
  return normalizedEnvironment === "production" ? true : requested;
}

export function createReadOnlyGcloudExecutor(underlyingExecute) {
  if (typeof underlyingExecute !== "function") throw new Error("A gcloud executor function is required.");
  const audit = {
    executedCommands: [],
    rejectedCommands: []
  };

  return {
    audit,
    async execute(args, options = {}) {
      const classification = classifyGcloudCommand(args);
      if (!classification.allowed || options.input !== undefined) {
        audit.rejectedCommands.push({
          commandPath: classification.commandPath,
          mutation: classification.mutation
        });
        throw new Error(
          `Read-only rehearsal rejected gcloud ${classification.commandPath || "unknown"} before execution.`
        );
      }
      audit.executedCommands.push({
        commandPath: classification.commandPath,
        mutation: false
      });
      return underlyingExecute(args, options);
    }
  };
}

export function classifyGcloudCommand(args) {
  if (!Array.isArray(args) || args.length === 0 || args.some((value) => typeof value !== "string")) {
    return { allowed: false, commandPath: "unknown", mutation: false };
  }
  const helpRequested = args.includes("--help") || args[0] === "help";
  if (helpRequested) {
    if (args[0] === "help" && args.every((value) => value !== "--")) {
      return {
        allowed: true,
        commandPath: args.filter((value) => !value.startsWith("-")).join(" "),
        mutation: false
      };
    }
    const helpPath = READ_ONLY_GCLOUD_HELP_PATHS.find((path) => startsWithPath(args, path));
    if (helpPath && args.filter((value) => !value.startsWith("-")).length === helpPath.length) {
      return { allowed: true, commandPath: `${helpPath.join(" ")} --help`, mutation: false };
    }
  }
  const allowedPath = READ_ONLY_GCLOUD_PATHS.find((path) => startsWithPath(args, path));
  if (allowedPath) {
    return { allowed: true, commandPath: allowedPath.join(" "), mutation: false };
  }
  const commandPath = resolveGcloudCommandPath(args);
  return {
    allowed: false,
    commandPath,
    mutation: commandPath.split(" ").some((token) => MUTATION_VERBS.has(token))
  };
}

export function summarizeGcloudCommandAudit(audit) {
  const executed = Array.isArray(audit?.executedCommands) ? audit.executedCommands : [];
  const rejected = Array.isArray(audit?.rejectedCommands) ? audit.rejectedCommands : [];
  return {
    executedReadOnlyCommands: executed.map(({ commandPath }) => ({ commandPath })),
    rejectedMutationCommands: rejected
      .filter(({ mutation }) => mutation)
      .map(({ commandPath }) => ({ commandPath })),
    executedReadOnlyCommandCount: executed.filter(({ mutation }) => mutation !== true).length,
    rejectedMutationCommandCount: rejected.filter(({ mutation }) => mutation === true).length,
    mutationCommandsExecuted: executed.some(({ mutation }) => mutation === true)
  };
}

export function initialServiceBootstrapPolicy(environment, configuredValue) {
  const normalizedEnvironment = String(environment || "").trim().toLowerCase();
  if (!new Set(["staging", "production"]).has(normalizedEnvironment)) {
    throw new Error("Initial service bootstrap environment must be staging or production.");
  }
  const expectedConfirmation = `ALLOW_INITIAL_SERVICE_BOOTSTRAP_${normalizedEnvironment.toUpperCase()}`;
  const confirmationRequired = normalizedEnvironment === "production";
  return {
    environment: normalizedEnvironment,
    mode: confirmationRequired ? "explicit_confirmation_required" : "staging_initial_bootstrap_allowed",
    confirmationRequired,
    expectedConfirmation,
    allowed: !confirmationRequired || configuredValue === expectedConfirmation
  };
}

export function evaluateSmokeWarningPolicy({
  environment,
  publicRequired,
  enforcePerformance,
  performanceWarnings = [],
  optionalPublicSurfaceWarnings = [],
  workerBootstrapWarnings = []
}) {
  const blockers = [];
  if (enforcePerformance && performanceWarnings.length > 0) blockers.push(...performanceWarnings);
  if (publicRequired && optionalPublicSurfaceWarnings.length > 0) blockers.push(...optionalPublicSurfaceWarnings);
  const warnings = [
    ...performanceWarnings,
    ...optionalPublicSurfaceWarnings,
    ...workerBootstrapWarnings
  ];
  const publicUnavailable = optionalPublicSurfaceWarnings.length > 0;
  return {
    blockers,
    warnings,
    status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "passed_with_warnings" : "passed",
    acceptance: {
      infrastructureDeployment: "passed",
      exactDeploymentSmoke: "passed",
      canonicalPublicSurfaces: publicUnavailable ? "unavailable_warning" : "passed",
      publicAcceptance: environment === "staging" && publicUnavailable ? "not_complete" : "passed"
    }
  };
}

export function resolveSmokeTargets({
  environment,
  deploymentReceipt,
  canonicalPublicUrls,
  requirePublicSurfaces: configuredRequirement
}) {
  if (!deploymentReceipt || deploymentReceipt.kind !== "gcp_cloud_run_deployment") {
    throw new Error("A checksum-verified Cloud Run services deployment receipt is required for deployment smoke.");
  }
  if (deploymentReceipt.status !== "deployed" || deploymentReceipt.phase !== "services") {
    throw new Error("Cloud Run deployment receipt must describe a completed services deployment.");
  }
  if (deploymentReceipt.environment !== environment) {
    throw new Error("Cloud Run deployment receipt environment does not match the smoke environment.");
  }

  const deployment = Object.fromEntries(REQUIRED_SERVICE_KEYS.map((key) => [
    key,
    normalizeHttpsOrigin(deploymentReceipt.urls?.[key], `deployment receipt urls.${key}`)
  ]));
  const canonical = Object.fromEntries(REQUIRED_SERVICE_KEYS.map((key) => [
    key,
    normalizeHttpsOrigin(canonicalPublicUrls?.[key], `canonical public URLs ${key}`)
  ]));
  const publicRequired = requirePublicSurfaces(environment, configuredRequirement);

  return {
    deployment,
    public: canonical,
    policy: {
      deploymentRequired: true,
      publicRequired,
      publicOptional: !publicRequired
    },
    duplicateRoles: REQUIRED_SERVICE_KEYS.filter((key) => deployment[key] === canonical[key])
  };
}

export function safeProbeOrigin(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : `${url.protocol}//${url.hostname}`;
  } catch {
    return "invalid-url";
  }
}

export function classifyProbeError(error, context = {}) {
  const chain = errorChain(error);
  const code = chain.map((item) => typeof item?.code === "string" ? item.code : "").find(Boolean) || null;
  const message = chain.map((item) => item instanceof Error ? item.message : String(item || "")).join(" ");
  let errorClass = context.errorClass || (code ? NETWORK_CODES[code] : null);

  if (!errorClass && /unsupported protocol|HTTPS is required/iu.test(message)) errorClass = "unsupported_protocol";
  if (!errorClass && /redirect count exceeded|too many redirects/iu.test(message)) errorClass = "redirect_loop";
  if (!errorClass && /aborted|aborterror|request timeout/iu.test(message)) errorClass = "request_timeout";
  if (!errorClass && /certificate.*expired/iu.test(message)) errorClass = "tls_certificate_expired";
  if (!errorClass && /hostname.*certificate|altname/iu.test(message)) errorClass = "tls_hostname_mismatch";
  if (!errorClass && /self[- ]signed|unknown ca|unable to verify/iu.test(message)) errorClass = "tls_unknown_ca";
  if (!errorClass && Number.isInteger(context.status)) errorClass = "http_status";
  if (!errorClass && /malformed json|did not return json/iu.test(message)) errorClass = "malformed_json";
  if (!errorClass && /response contract|validation/iu.test(message)) errorClass = "response_validation";
  if (!errorClass && /body limit|response body/iu.test(message)) errorClass = "response_body_limit";
  if (!errorClass) errorClass = "network_or_transport";

  return {
    probe: String(context.probe || "unknown"),
    origin: safeProbeOrigin(context.url),
    errorClass,
    nodeCode: code,
    status: Number.isInteger(context.status) ? context.status : null,
    attempt: Number.isInteger(context.attempt) ? context.attempt : null,
    elapsedMs: Number.isFinite(context.elapsedMs) ? Math.round(context.elapsedMs) : null
  };
}

export function formatProbeFailure(diagnostic) {
  const fields = [
    `probe=${diagnostic.probe}`,
    `origin=${diagnostic.origin}`,
    `class=${diagnostic.errorClass}`
  ];
  if (diagnostic.nodeCode) fields.push(`code=${diagnostic.nodeCode}`);
  if (diagnostic.status !== null) fields.push(`status=${diagnostic.status}`);
  if (diagnostic.attempt !== null) fields.push(`attempt=${diagnostic.attempt}`);
  if (diagnostic.elapsedMs !== null) fields.push(`elapsedMs=${diagnostic.elapsedMs}`);
  return fields.join(" ");
}

export function assertServiceUrlReadBack(deploymentUrls, describedUrls) {
  for (const key of REQUIRED_SERVICE_KEYS) {
    const deployed = normalizeHttpsOrigin(deploymentUrls?.[key], `deployment URL ${key}`);
    const described = normalizeHttpsOrigin(describedUrls?.[key], `described URL ${key}`);
    if (deployed !== described) {
      throw new Error(`Cloud Run service ${key} URL read-back does not match the deployment receipt.`);
    }
  }
}

export function validateResolvedReleaseContract(contract, environment) {
  if (contract?.schemaVersion !== RELEASE_CONTRACT_SCHEMA_VERSION) {
    throw new Error("Unsupported resolved release contract schemaVersion.");
  }
  if (contract.kind !== "resolved_cloud_run_release_contract") {
    throw new Error("Resolved release contract kind is invalid.");
  }
  if (contract.environment !== environment) {
    throw new Error("Resolved release contract environment mismatch.");
  }
  if (!/^[a-f0-9]{40}$/u.test(String(contract.gitSha || ""))) {
    throw new Error("Resolved release contract gitSha is invalid.");
  }
  for (const key of REQUIRED_SERVICE_KEYS) {
    normalizeHttpsOrigin(contract.services?.[key]?.url, `resolved service ${key} URL`);
    normalizeHttpsOrigin(contract.canonicalPublicUrls?.[key], `resolved canonical ${key} URL`);
    if (!contract.services?.[key]?.name) throw new Error(`Resolved service ${key} name is missing.`);
    if (!String(contract.images?.[key] || "").includes("@sha256:")) {
      throw new Error(`Resolved image ${key} is not digest-pinned.`);
    }
  }
  if (contract.environment === "production" && contract.smokePolicy?.requirePublicSurfaces !== true) {
    throw new Error("Production resolved release contract must require public surfaces.");
  }
  if (contract.environment === "production" && contract.backup?.replicaVerified !== true) {
    throw new Error("Production resolved release contract requires a byte-verified backup replica.");
  }
  return contract;
}

export function assembleResolvedReleaseContract({
  environment,
  cloudRunContract,
  cloudRunContractSha256,
  gitSha,
  imageManifest,
  deploymentReceipt,
  migrationReceipt,
  databasePostflightReceipt,
  canonicalPublicUrls,
  references,
  rollbackSnapshot,
  backup,
  createdAt = new Date().toISOString()
}) {
  const project = cloudRunContract.projects?.[environment];
  if (!project) throw new Error(`Cloud Run project is missing for ${environment}.`);
  if (imageManifest.gitSha !== gitSha || deploymentReceipt.gitSha !== gitSha) {
    throw new Error("Image manifest and services deployment receipt must match the release gitSha.");
  }
  if (migrationReceipt.gitSha !== gitSha) {
    throw new Error("Migration receipt gitSha does not match the services deployment receipt.");
  }
  if (databasePostflightReceipt.gitSha !== gitSha) {
    throw new Error("Database postflight receipt gitSha does not match the services deployment receipt.");
  }
  if (deploymentReceipt.environment !== environment || deploymentReceipt.project !== project) {
    throw new Error("Services deployment receipt environment/project mismatch.");
  }
  if (migrationReceipt.environment !== environment || migrationReceipt.project !== project) {
    throw new Error("Migration receipt environment/project mismatch.");
  }
  validateRollbackSnapshot(rollbackSnapshot, cloudRunContract, environment);

  const requirePublic = requirePublicSurfaces(
    environment,
    canonicalPublicUrls.requirePublicSurfaces
  );
  const publicUrls = Object.fromEntries(REQUIRED_SERVICE_KEYS.map((key) => [
    key,
    normalizeHttpsOrigin(canonicalPublicUrls[key], `canonical public URL ${key}`)
  ]));
  const services = Object.fromEntries(REQUIRED_SERVICE_KEYS.map((key) => [key, {
    name: cloudRunContract.services[key].name,
    public: cloudRunContract.services[key].public === true,
    url: normalizeHttpsOrigin(deploymentReceipt.urls?.[key], `deployment URL ${key}`)
  }]));
  const jobs = Object.fromEntries(Object.entries(cloudRunContract.jobs).map(([key, config]) => [key, {
    name: config.name,
    scheduled: Boolean(config.schedule)
  }]));
  const schedulers = Object.fromEntries(
    Object.entries(deploymentReceipt.scheduledInfrastructure || {}).map(([key, infrastructure]) => [key, {
      name: infrastructure.scheduler?.name,
      state: infrastructure.scheduler?.state,
      schedule: infrastructure.scheduler?.schedule,
      timezone: infrastructure.scheduler?.timeZone,
      uri: infrastructure.scheduler?.uri,
      httpMethod: infrastructure.scheduler?.httpMethod,
      oauthServiceAccountEmail: infrastructure.scheduler?.oauthServiceAccountEmail,
      exactConfigurationVerified: [
        "enabledVerified",
        "scheduleVerified",
        "timeZoneVerified",
        "httpMethodVerified",
        "uriVerified",
        "oauthServiceAccountVerified"
      ].every((field) => infrastructure.scheduler?.[field] === true),
      jobScopedIam: infrastructure.iam
    }])
  );
  for (const [key, config] of Object.entries(cloudRunContract.jobs).filter(([, value]) => value.schedule)) {
    const scheduler = schedulers[key];
    if (!scheduler || scheduler.name !== `${config.name}-schedule`) {
      throw new Error(`Resolved scheduler ${key} is missing or has the wrong name.`);
    }
    if (scheduler.exactConfigurationVerified !== true) {
      throw new Error(`Resolved scheduler ${key} exact configuration was not verified.`);
    }
    if (scheduler.jobScopedIam?.jobScoped !== true || scheduler.jobScopedIam?.verified !== true) {
      throw new Error(`Resolved scheduler ${key} job-scoped IAM was not verified.`);
    }
  }

  const contract = {
    schemaVersion: RELEASE_CONTRACT_SCHEMA_VERSION,
    kind: "resolved_cloud_run_release_contract",
    createdAt,
    environment,
    project,
    region: cloudRunContract.region,
    schedulerRegion: cloudRunContract.schedulerRegion,
    gitSha,
    cloudRunContractSha256,
    images: imageManifest.images,
    services,
    canonicalPublicUrls: publicUrls,
    jobs,
    schedulers,
    receipts: references,
    migration: {
      job: migrationReceipt.job,
      status: migrationReceipt.status,
      gitSha: migrationReceipt.gitSha
    },
    databasePostflight: {
      status: databasePostflightReceipt.status,
      gitSha: databasePostflightReceipt.gitSha,
      migrationHead: databasePostflightReceipt.migrations?.checkedInHead || null
    },
    smokePolicy: {
      deploymentTargets: "checksum_verified_services_receipt",
      deploymentRequired: true,
      requirePublicSurfaces: requirePublic,
      workerBootstrapGraceSeconds: environment === "staging" ? 360 : 0,
      productionBootstrapGraceAllowed: false
    },
    probes: {
      required: [
        "api-liveness",
        "api-readiness",
        "api-openapi",
        "api-capabilities",
        "api-categories",
        "api-listings",
        "web-home",
        "web-login",
        "web-browse",
        "backoffice-login",
        "web-legal-surfaces"
      ],
      public: {
        required: requirePublic,
        names: ["public-api-liveness", "public-web-home", "public-backoffice-login"]
      }
    },
    rollback: {
      snapshot: references.rollbackSnapshot,
      services: rollbackSnapshot.services
    },
    backup,
    artifacts: {
      smokeEvidence: {
        path: resolve(`.release/gcp/${environment}/deployment-smoke.json`),
        checksumPath: resolve(`.release/gcp/${environment}/deployment-smoke.json.sha256`)
      },
      metadata: {
        path: resolve(`.release/gcp/${environment}/deployment-metadata.json`),
        checksumPath: resolve(`.release/gcp/${environment}/deployment-metadata.json.sha256`)
      },
      uploadRoots: [resolve(".release"), backup?.directory].filter(Boolean),
      requiredReferences: Object.values(references).map((reference) => reference.path)
    }
  };
  return validateResolvedReleaseContract(contract, environment);
}

export function buildProtectedReference(path, checksum) {
  const resolvedPath = resolve(path);
  if (!/^[a-f0-9]{64}$/u.test(String(checksum || ""))) {
    throw new Error(`Receipt checksum is invalid for ${resolvedPath}.`);
  }
  return { path: resolvedPath, checksum, checksumPath: `${resolvedPath}.sha256` };
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateRollbackSnapshot(snapshot, cloudRunContract, environment) {
  if (snapshot?.kind !== "gcp_cloud_run_rollback_snapshot" || snapshot.environment !== environment) {
    throw new Error("Rollback snapshot contract is invalid.");
  }
  for (const [key, service] of Object.entries(cloudRunContract.services)) {
    const record = snapshot.services?.[key];
    if (record?.name !== service.name) throw new Error(`Rollback service ${key} name mismatch.`);
    if (record?.state === "absent") {
      if (Array.isArray(record.traffic) && record.traffic.length > 0) {
        throw new Error(`Rollback service ${key} is absent but contains traffic.`);
      }
      continue;
    }
    if (record?.state !== "existing") throw new Error(`Rollback service ${key} state is invalid.`);
    validateRollbackTraffic(record.traffic, `Rollback service ${key}`);
  }
  return snapshot;
}

export function validateRollbackTraffic(traffic, label = "Rollback traffic") {
  if (!Array.isArray(traffic) || traffic.length === 0) throw new Error(`${label} is empty.`);
  const seen = new Set();
  let total = 0;
  for (const entry of traffic) {
    if (entry?.tag || entry?.latestRevision === true) {
      throw new Error(`${label} contains an unsupported tag/latestRevision route.`);
    }
    const revisionName = String(entry?.revisionName || "");
    if (!/^[a-z][a-z0-9-]{1,62}$/u.test(revisionName)) {
      throw new Error(`${label} contains an invalid revision.`);
    }
    if (seen.has(revisionName)) throw new Error(`${label} contains a duplicate revision.`);
    seen.add(revisionName);
    if (!Number.isInteger(entry.percent) || entry.percent <= 0 || entry.percent > 100) {
      throw new Error(`${label} contains an invalid traffic percentage.`);
    }
    total += entry.percent;
  }
  if (total !== 100) throw new Error(`${label} percentages must total 100.`);
  return traffic.map(({ revisionName, percent }) => ({ revisionName, percent }));
}

export function exactTrafficMatches(actual, expected) {
  try {
    const normalizedActual = validateRollbackTraffic(actual, "Rollback read-back traffic");
    const normalizedExpected = validateRollbackTraffic(expected, "Expected rollback traffic");
    return normalizedTrafficKey(normalizedActual) === normalizedTrafficKey(normalizedExpected);
  } catch {
    return false;
  }
}

export function buildTrafficRollbackArgs({ service, traffic, project, region }) {
  if (!/^[a-z][a-z0-9-]{1,62}$/u.test(String(service || ""))) throw new Error("Rollback service name is invalid.");
  const distribution = validateRollbackTraffic(traffic, `Rollback service ${service} traffic`)
    .map(({ revisionName, percent }) => `${revisionName}=${percent}`)
    .join(",");
  return [
    "run", "services", "update-traffic", service,
    `--project=${project}`,
    `--region=${region}`,
    `--to-revisions=${distribution}`
  ];
}

export async function runReleaseStageChecks(checks) {
  const blockers = [];
  const warnings = [];
  const unverifiedMutationOnly = [];
  const checkedStages = [];

  for (const stage of RELEASE_STAGES) {
    try {
      const result = await (checks[stage] || (async () => ({
        unverifiedMutationOnly: `${stage} requires deployment-time mutation or generated output.`
      })))();
      checkedStages.push({ stage, status: result?.status || "verified" });
      for (const warning of result?.warnings || []) warnings.push(`${stage}: ${warning}`);
      if (result?.unverifiedMutationOnly) {
        const values = Array.isArray(result.unverifiedMutationOnly)
          ? result.unverifiedMutationOnly
          : [result.unverifiedMutationOnly];
        for (const value of values) unverifiedMutationOnly.push(`${stage}: ${value}`);
        checkedStages.at(-1).status = "unverified-mutation-only";
      }
    } catch (error) {
      blockers.push(`${stage}: ${error instanceof Error ? error.message : String(error)}`);
      checkedStages.push({ stage, status: "blocked" });
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    unverifiedMutationOnly,
    checkedStages
  };
}

export function receiptChecksumLine(checksum, path) {
  return `${checksum}  ${basename(path)}`;
}

function errorChain(error) {
  const result = [];
  const seen = new Set();
  let current = error;
  while (current && !seen.has(current)) {
    result.push(current);
    seen.add(current);
    current = current.cause;
  }
  return result;
}

function startsWithPath(args, path) {
  return path.every((token, index) => args[index] === token);
}

function resolveGcloudCommandPath(args) {
  const depthByPrefix = new Map([
    ["artifacts", 3],
    ["iam", 3],
    ["scheduler", 3],
    ["secrets:versions", 3],
    ["run:jobs", 3],
    ["run:services", 3]
  ]);
  const key = args[0] === "secrets" && args[1] === "versions"
    ? "secrets:versions"
    : `${args[0]}:${args[1]}`;
  const depth = depthByPrefix.get(key) || depthByPrefix.get(args[0]) || 2;
  return args.slice(0, depth).filter((value) => !value.startsWith("-")).join(" ") || "unknown";
}

function normalizedTrafficKey(traffic) {
  return [...traffic]
    .sort((left, right) => left.revisionName.localeCompare(right.revisionName))
    .map(({ revisionName, percent }) => `${revisionName}=${percent}`)
    .join(",");
}

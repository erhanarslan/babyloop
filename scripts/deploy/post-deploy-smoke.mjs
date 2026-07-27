#!/usr/bin/env node
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
  assessDeploymentReadiness,
  assertEnvironment,
  readJsonReceipt,
  timestampForFile,
  writeJsonReceipt
} from "./deployment-lib.mjs";
import { RELEASE_EVIDENCE_SCHEMA_VERSION, summarizeSamples } from "./release-evidence-lib.mjs";
import {
  API_DEPLOYMENT_SMOKE_ENDPOINTS,
  BACKOFFICE_DEPLOYMENT_SMOKE_ENDPOINTS,
  failedOpenApiOutcome,
  passedOpenApiOutcome,
  planOpenApiProbe,
  readRuntimeCapabilities,
  validateOpenApiProbeResponse,
  WEB_DEPLOYMENT_SMOKE_ENDPOINTS
} from "./deployment-smoke-contract.mjs";
import {
  classifyProbeError,
  evaluateSmokeWarningPolicy,
  formatProbeFailure,
  resolveSmokeTargets,
  safeProbeOrigin,
  validateResolvedReleaseContract
} from "./release-orchestration-lib.mjs";

const environment = assertEnvironment(process.env.DEPLOY_ENVIRONMENT);
const releaseContractPath = resolve(
  process.env.DEPLOY_RELEASE_CONTRACT_PATH
    || `.release/gcp/${environment}/resolved-release-contract.json`
);
const releaseContract = validateResolvedReleaseContract(
  await readJsonReceipt(releaseContractPath),
  environment
);
const cloudRunDeploymentReceipt = await readReferencedReceipt(
  releaseContract.receipts.deployment,
  "Cloud Run services deployment"
);
const targets = resolveSmokeTargets({
  environment,
  deploymentReceipt: cloudRunDeploymentReceipt,
  canonicalPublicUrls: releaseContract.canonicalPublicUrls,
  requirePublicSurfaces: releaseContract.smokePolicy.requirePublicSurfaces
});
const apiUrl = targets.deployment.api;
const webUrl = targets.deployment.web;
const backofficeUrl = targets.deployment.backoffice;
const metricsToken = process.env.OBSERVABILITY_METRICS_TOKEN;
const attempts = readInteger("DEPLOY_SMOKE_ATTEMPTS", 18, 1, 60);
const delayMs = readInteger("DEPLOY_SMOKE_DELAY_MS", 5000, 500, 30000);
const timeoutMs = readInteger("DEPLOY_SMOKE_TIMEOUT_MS", 8000, 500, 30000);
const sampleCount = readInteger("DEPLOY_ACCEPTANCE_SAMPLES", 3, 1, 10);
const maxP95Ms = readInteger("DEPLOY_ACCEPTANCE_MAX_P95_MS", environment === "production" ? 2500 : 4000, 250, 30000);
const maxHtmlBytes = readInteger("DEPLOY_ACCEPTANCE_MAX_HTML_BYTES", 2_000_000, 10_000, 10_000_000);
const maxJsonBytes = readInteger("DEPLOY_ACCEPTANCE_MAX_JSON_BYTES", 750_000, 1_000, 5_000_000);
const enforcePerformance = readBoolean("DEPLOY_ACCEPTANCE_ENFORCE_PERFORMANCE", environment === "production");
const workerBootstrapGraceSeconds = readInteger(
  "DEPLOY_WORKER_BOOTSTRAP_GRACE_SECONDS",
  environment === "staging" ? 360 : 0,
  0,
  900
);

const probes = { deployment: {}, public: {} };
const performanceWarnings = [];
const optionalPublicSurfaceWarnings = [];
const workerBootstrapWarnings = [];
const createdAt = new Date().toISOString();
const evidencePath = resolve(
  releaseContract.artifacts?.smokeEvidence?.path
    || process.env.DEPLOY_ACCEPTANCE_EVIDENCE_PATH
    || `.release/evidence/${environment}-acceptance-${timestampForFile(new Date(createdAt))}.json`
);
let runtimeCapabilities = null;
let openApiOutcome = {
  status: "not_checked",
  enabled: null,
  accessMode: "unknown"
};
let workerBootstrap = {
  active: false,
  blockingDependencies: [],
  deploymentReceiptPath: releaseContract.receipts.deployment.path
};

function validateApiReadiness({ body }) {
  const coreReady = body?.dependencies?.database?.status === "ready"
    && body?.dependencies?.schema?.status === "ready"
    && body?.dependencies?.storage?.status === "ready"
    && (process.env.RAG_ENABLED !== "true" || body?.dependencies?.ragVectorStore?.status === "ready")
    && (process.env.RAG_REDIS_ENABLED !== "true" || body?.dependencies?.ragRedis?.status === "ready");
  if (!coreReady) return false;

  const assessment = assessDeploymentReadiness(body, {
    bootstrapGraceSeconds: workerBootstrapGraceSeconds,
    deploymentReceipt: cloudRunDeploymentReceipt,
    environment
  });
  if (assessment.bootstrapGrace) {
    workerBootstrap = {
      active: true,
      blockingDependencies: assessment.blockingDependencies,
      deploymentReceiptPath: releaseContract.receipts.deployment.path,
      graceAgeSeconds: assessment.graceAgeSeconds,
      graceExpiresAt: assessment.graceExpiresAt
    };
  }
  return assessment.ready;
}

await waitFor("deployment-api-liveness", endpointUrl(apiUrl, apiEndpoint("api-liveness")), {
  attempts,
  delayMs,
  timeoutMs,
  maxBytes: maxJsonBytes,
  parseJson: true,
  publicContract: releaseContract.services.api.public === true,
  validate: ({ body }) => body?.live === true
});
await waitFor("deployment-api-readiness", endpointUrl(apiUrl, apiEndpoint("api-readiness")), {
  attempts,
  acceptedStatuses: [200, 503],
  delayMs,
  timeoutMs,
  maxBytes: maxJsonBytes,
  parseJson: true,
  publicContract: releaseContract.services.api.public === true,
  validate: validateApiReadiness
});
if (workerBootstrap.active) {
  workerBootstrapWarnings.push(
    `Worker heartbeat bootstrap grace is active for ${workerBootstrap.blockingDependencies.join(", ")} until ${workerBootstrap.graceExpiresAt}.`
  );
}

const initialDeploymentProbes = [
  jsonProbe("api-liveness", endpointUrl(apiUrl, apiEndpoint("api-liveness")), ({ body }) => body?.live === true, { publicContract: true }),
  jsonProbe("api-readiness", endpointUrl(apiUrl, apiEndpoint("api-readiness")), validateApiReadiness, {
    acceptedStatuses: [200, 503],
    publicContract: true
  }),
];

for (const definition of initialDeploymentProbes) {
  probes.deployment[definition.name] = await sampleProbe(definition, sampleCount);
  recordThresholdWarnings(definition, probes.deployment[definition.name]);
}

const capabilitiesDefinition = jsonProbe(
  "api-capabilities",
  endpointUrl(apiUrl, apiEndpoint("api-capabilities")),
  ({ body }) => {
    try {
      runtimeCapabilities = readRuntimeCapabilities(body);
      return true;
    } catch {
      return false;
    }
  },
  { publicContract: true }
);
probes.deployment[capabilitiesDefinition.name] = await sampleProbe(capabilitiesDefinition, sampleCount);
recordThresholdWarnings(capabilitiesDefinition, probes.deployment[capabilitiesDefinition.name]);

const openApiPlan = planOpenApiProbe(runtimeCapabilities);
openApiOutcome = openApiPlan.outcome;
if (!openApiPlan.request) {
  probes.deployment["api-openapi"] = openApiPlan.evidence;
} else {
  const definition = jsonProbe(
    "api-openapi",
    endpointUrl(apiUrl, apiEndpoint("api-openapi")),
    ({ body, headers, status }) => validateOpenApiProbeResponse({
      status,
      contentType: headers["content-type"],
      body
    }),
    { publicContract: true }
  );
  try {
    const openApiEvidence = await sampleProbe(definition, sampleCount);
    probes.deployment[definition.name] = {
      ...openApiEvidence,
      status: "passed",
      required: true
    };
    openApiOutcome = passedOpenApiOutcome(runtimeCapabilities);
    recordThresholdWarnings(definition, openApiEvidence);
  } catch (error) {
    openApiOutcome = failedOpenApiOutcome(runtimeCapabilities);
    probes.deployment[definition.name] = {
      status: "failed",
      required: true,
      diagnostic: error?.diagnostic || classifyProbeError(error, {
        probe: definition.name,
        url: definition.url
      })
    };
    await writeOpenApiFailureEvidence(error);
    throw error;
  }
}

const remainingDeploymentProbes = [
  jsonProbe("api-categories", endpointUrl(apiUrl, apiEndpoint("api-categories")), ({ body, headers }) => body?.ok === true
    && Array.isArray(body?.data?.categories)
    && String(headers["cache-control"] || "").includes("max-age=300"), { publicContract: true }),
  jsonProbe(
    "api-listings",
    endpointUrl(apiUrl, apiEndpoint("api-listings")),
    ({ body }) => body?.ok === true
      && Array.isArray(body?.data?.listings)
      && body?.data?.pagination?.total === null,
    { publicContract: true }
  ),
  ...WEB_DEPLOYMENT_SMOKE_ENDPOINTS
    .filter(({ name }) => new Set(["web-home", "web-login", "web-browse"]).has(name))
    .map((endpoint) => htmlProbe(endpoint.name, endpointUrl(webUrl, endpoint), {
      publicContract: releaseContract.services.web.public === true
    })),
  htmlProbe("backoffice-login", endpointUrl(backofficeUrl, backofficeEndpoint("backoffice-login")), {
    publicContract: releaseContract.services.backoffice.public === true
  })
];

for (const definition of remainingDeploymentProbes) {
  probes.deployment[definition.name] = await sampleProbe(definition, sampleCount);
  recordThresholdWarnings(definition, probes.deployment[definition.name]);
}

for (const endpoint of WEB_DEPLOYMENT_SMOKE_ENDPOINTS.filter(
  ({ name }) => !new Set(["web-home", "web-login", "web-browse"]).has(name)
)) {
  const definition = htmlProbe(endpoint.name, endpointUrl(webUrl, endpoint), {
    publicContract: releaseContract.services.web.public === true
  });
  probes.deployment[endpoint.name] = await sampleProbe(definition, 1);
}

if (metricsToken) {
  const metricsUrl = endpointUrl(apiUrl, apiEndpoint("api-metrics"));
  const metrics = await request("deployment-api-metrics", metricsUrl, {
    headers: { authorization: `Bearer ${metricsToken}` },
    timeoutMs,
    maxBytes: maxJsonBytes,
    parseJson: false,
    publicContract: true
  });
  if (!metrics.text.includes("babyloop_")) {
    throw probeFailure("deployment-api-metrics", metricsUrl, {
      errorClass: "response_validation",
      attempt: 1,
      elapsedMs: metrics.durationMs
    });
  }
  probes.deployment.metrics = probeEvidence(metricsUrl, [metrics]);
}

await runPublicSurfaceProbes();

const warningPolicy = evaluateSmokeWarningPolicy({
  environment,
  publicRequired: targets.policy.publicRequired,
  enforcePerformance,
  performanceWarnings,
  optionalPublicSurfaceWarnings,
  workerBootstrapWarnings
});
if (warningPolicy.blockers.length > 0) {
  throw new Error(`Deployment acceptance policy failed:\n- ${warningPolicy.blockers.join("\n- ")}`);
}
const warnings = warningPolicy.warnings;

const evidence = {
  schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
  kind: "deployment_acceptance",
  status: warningPolicy.status,
  createdAt,
  environment,
  gitSha: releaseContract.gitSha,
  releaseContract: {
    path: releaseContractPath,
    checksum: await checksumFromSidecar(releaseContractPath)
  },
  endpoints: {
    deployment: targets.deployment,
    public: targets.public,
    deduplicatedRoles: targets.duplicateRoles
  },
  smokePolicy: targets.policy,
  thresholds: {
    enforcePerformance,
    maxHtmlBytes,
    maxJsonBytes,
    maxP95Ms,
    sampleCount
  },
  metricsChecked: Boolean(metricsToken),
  operationalPolicy: {
    analyticsIngestReady: true,
    emailDeliveryMode: process.env.EMAIL_DELIVERY_MODE || "unset",
    emailProvider: process.env.EMAIL_PROVIDER || "unset",
    providerCallsAllowed: process.env.PROVIDER_CALLS_ALLOWED === "true",
    ragCollection: process.env.RAG_ENABLED === "true" ? process.env.RAG_QDRANT_COLLECTION : null,
    redisKeyPrefix: process.env.RAG_REDIS_ENABLED === "true" ? process.env.RAG_REDIS_KEY_PREFIX : null,
    storageDriver: process.env.IMAGE_STORAGE_DRIVER || "unset"
  },
  workerBootstrap,
  runtimeCapabilities,
  openApi: openApiOutcome,
  acceptance: warningPolicy.acceptance,
  probes,
  performanceWarnings,
  optionalPublicSurfaceWarnings,
  workerBootstrapWarnings,
  warnings
};

const receipt = await writeJsonReceipt(evidencePath, evidence);
process.stdout.write(`${JSON.stringify({
  ok: true,
  status: evidence.status,
  environment,
  evidencePath: receipt.path,
  checksum: receipt.checksum,
  gitSha: releaseContract.gitSha,
  warnings
}, null, 2)}\n`);

async function runPublicSurfaceProbes() {
  const definitions = [
    jsonProbe("public-api-liveness", endpointUrl(targets.public.api, apiEndpoint("api-liveness")), ({ body }) => body?.live === true, { role: "api" }),
    htmlProbe("public-web-home", endpointUrl(targets.public.web, webEndpoint("web-home")), { role: "web" }),
    htmlProbe("public-backoffice-login", endpointUrl(targets.public.backoffice, backofficeEndpoint("backoffice-login")), { role: "backoffice" })
  ];
  for (const definition of definitions) {
    if (targets.duplicateRoles.includes(definition.role)) {
      probes.public[definition.name] = {
        deduplicated: true,
        deploymentOrigin: targets.deployment[definition.role],
        origin: targets.public[definition.role]
      };
      continue;
    }
    try {
      probes.public[definition.name] = await sampleProbe(definition, 1);
    } catch (error) {
      if (targets.policy.publicRequired) throw error;
      const diagnostic = error?.diagnostic || classifyProbeError(error, {
        probe: definition.name,
        url: definition.url,
        attempt: 1
      });
      probes.public[definition.name] = { status: "warning", diagnostic };
      optionalPublicSurfaceWarnings.push(`Optional public surface unavailable: ${formatProbeFailure(diagnostic)}`);
    }
  }
}

function apiEndpoint(name) {
  return requiredEndpoint(API_DEPLOYMENT_SMOKE_ENDPOINTS, name);
}

function webEndpoint(name) {
  return requiredEndpoint(WEB_DEPLOYMENT_SMOKE_ENDPOINTS, name);
}

function backofficeEndpoint(name) {
  return requiredEndpoint(BACKOFFICE_DEPLOYMENT_SMOKE_ENDPOINTS, name);
}

function requiredEndpoint(collection, name) {
  const endpoint = collection.find((candidate) => candidate.name === name);
  if (!endpoint) throw new Error(`Deployment smoke endpoint contract is missing ${name}.`);
  return endpoint;
}

function endpointUrl(origin, endpoint) {
  const base = `${origin}${endpoint.path === "/" ? "" : endpoint.path}`;
  return endpoint.query ? `${base}?${endpoint.query}` : base;
}

async function writeOpenApiFailureEvidence(error) {
  const diagnostic = error?.diagnostic || classifyProbeError(error, {
    probe: "api-openapi",
    url: endpointUrl(apiUrl, apiEndpoint("api-openapi"))
  });
  await writeJsonReceipt(evidencePath, {
    schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
    kind: "deployment_acceptance",
    status: "failed",
    createdAt,
    environment,
    gitSha: releaseContract.gitSha,
    releaseContract: {
      path: releaseContractPath,
      checksum: await checksumFromSidecar(releaseContractPath)
    },
    endpoints: {
      deployment: targets.deployment,
      public: targets.public,
      deduplicatedRoles: targets.duplicateRoles
    },
    smokePolicy: targets.policy,
    runtimeCapabilities,
    openApi: openApiOutcome,
    probes,
    failure: {
      probe: "api-openapi",
      diagnostic
    },
    performanceWarnings,
    optionalPublicSurfaceWarnings,
    workerBootstrapWarnings,
    warnings: [
      ...performanceWarnings,
      ...optionalPublicSurfaceWarnings,
      ...workerBootstrapWarnings
    ]
  });
}

function jsonProbe(name, url, validate, extra = {}) {
  return { name, url, kind: "json", validate, ...extra };
}

function htmlProbe(name, url, extra = {}) {
  return {
    name,
    url,
    kind: "html",
    requiredHeaders: ["content-security-policy", "x-content-type-options"],
    ...extra
  };
}

function recordThresholdWarnings(definition, evidence) {
  const byteLimit = definition.kind === "html" ? maxHtmlBytes : maxJsonBytes;
  if (evidence.summary.p95Ms > maxP95Ms) {
    performanceWarnings.push(`${definition.name} p95 ${evidence.summary.p95Ms}ms exceeds ${maxP95Ms}ms.`);
  }
  if (evidence.summary.maxBytes > byteLimit) {
    performanceWarnings.push(`${definition.name} response ${evidence.summary.maxBytes} bytes exceeds ${byteLimit}.`);
  }
}

async function sampleProbe(definition, count) {
  const samples = [];
  for (let index = 0; index < count; index += 1) {
    const result = await request(definition.name, definition.url, {
      timeoutMs,
      maxBytes: definition.kind === "html" ? maxHtmlBytes : maxJsonBytes,
      acceptedStatuses: definition.acceptedStatuses,
      parseJson: definition.kind === "json",
      publicContract: definition.publicContract
    });
    let valid = true;
    try {
      valid = definition.validate ? definition.validate(result) : true;
    } catch {
      valid = false;
    }
    if (!valid) {
      throw probeFailure(definition.name, definition.url, {
        errorClass: "response_validation",
        attempt: index + 1,
        elapsedMs: result.durationMs,
        status: result.status
      });
    }
    for (const header of definition.requiredHeaders || []) {
      if (!result.headers[header]) {
        throw probeFailure(definition.name, definition.url, {
          errorClass: "response_validation",
          attempt: index + 1,
          elapsedMs: result.durationMs,
          status: result.status
        });
      }
    }
    const contentType = result.headers["content-type"] || "";
    if (definition.kind === "json" && !contentType.includes("application/json")) {
      throw probeFailure(definition.name, definition.url, {
        errorClass: "response_validation",
        attempt: index + 1,
        elapsedMs: result.durationMs,
        status: result.status
      });
    }
    if (definition.kind === "html" && !contentType.includes("text/html")) {
      throw probeFailure(definition.name, definition.url, {
        errorClass: "response_validation",
        attempt: index + 1,
        elapsedMs: result.durationMs,
        status: result.status
      });
    }
    samples.push(result);
  }
  return probeEvidence(definition.url, samples);
}

async function waitFor(name, url, options) {
  let lastDiagnostic;
  const startedAt = performance.now();
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const result = await request(name, url, { ...options, attempt });
      if (options.validate && !options.validate(result)) {
        throw probeFailure(name, url, {
          errorClass: "response_validation",
          attempt,
          elapsedMs: performance.now() - startedAt,
          status: result.status
        });
      }
      return result;
    } catch (error) {
      lastDiagnostic = error?.diagnostic || classifyProbeError(error, {
        probe: name,
        url,
        attempt,
        elapsedMs: performance.now() - startedAt
      });
      if (attempt < options.attempts) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, options.delayMs));
      }
    }
  }
  throw probeFailure(name, url, {
    ...lastDiagnostic,
    attempt: options.attempts,
    elapsedMs: performance.now() - startedAt
  });
}

async function request(name, url, options) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw probeFailure(name, url, { errorClass: "unsupported_protocol", cause: error, attempt: options.attempt || 1 });
  }
  if (parsed.protocol !== "https:") {
    throw probeFailure(name, url, { errorClass: "unsupported_protocol", attempt: options.attempt || 1 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      headers: options.headers,
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok && !options.acceptedStatuses?.includes(response.status)) {
      throw probeFailure(name, url, {
        errorClass: options.publicContract && new Set([401, 403]).has(response.status)
          ? "public_iam_contract"
          : "http_status",
        status: response.status,
        attempt: options.attempt || 1,
        elapsedMs: performance.now() - startedAt
      });
    }
    const text = await readLimitedBody(response, options.maxBytes, name, url, options.attempt || 1, startedAt);
    let body = null;
    if (options.parseJson !== false) {
      try {
        body = JSON.parse(text);
      } catch (error) {
        throw probeFailure(name, url, {
          errorClass: "malformed_json",
          cause: error,
          status: response.status,
          attempt: options.attempt || 1,
          elapsedMs: performance.now() - startedAt
        });
      }
    }
    return {
      body,
      bytes: Buffer.byteLength(text),
      durationMs: performance.now() - startedAt,
      finalUrl: safeEvidenceUrl(response.url),
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status,
      text
    };
  } catch (error) {
    if (error?.diagnostic) throw error;
    throw probeFailure(name, url, {
      cause: error,
      attempt: options.attempt || 1,
      elapsedMs: performance.now() - startedAt
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readLimitedBody(response, maximumBytes, name, url, attempt, startedAt) {
  const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    await response.body?.cancel();
    throw probeFailure(name, url, {
      errorClass: "response_body_limit",
      status: response.status,
      attempt,
      elapsedMs: performance.now() - startedAt
    });
  }
  if (!response.body) return "";
  const chunks = [];
  let bytes = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      throw probeFailure(name, url, {
        errorClass: "response_body_limit",
        status: response.status,
        attempt,
        elapsedMs: performance.now() - startedAt
      });
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

function probeFailure(name, url, context) {
  const diagnostic = context.probe
    ? context
    : classifyProbeError(context.cause || new Error(context.errorClass || "probe failed"), {
        probe: name,
        url,
        errorClass: context.errorClass,
        status: context.status,
        attempt: context.attempt,
        elapsedMs: context.elapsedMs
      });
  const error = new Error(formatProbeFailure(diagnostic), context.cause ? { cause: context.cause } : undefined);
  error.diagnostic = diagnostic;
  return error;
}

function probeEvidence(url, samples) {
  return {
    origin: safeProbeOrigin(url),
    samples: samples.map(publicSample),
    summary: summarizeSamples(samples)
  };
}

function publicSample(result) {
  return {
    bytes: result.bytes,
    durationMs: Math.round(result.durationMs * 100) / 100,
    finalUrl: result.finalUrl,
    status: result.status,
    headers: pickHeaders(result.headers)
  };
}

function pickHeaders(headers) {
  const result = {};
  for (const key of ["cache-control", "content-security-policy", "content-type", "etag", "strict-transport-security", "x-content-type-options"]) {
    if (headers[key]) result[key] = headers[key];
  }
  return result;
}

function safeEvidenceUrl(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "invalid-url";
  }
}

async function readReferencedReceipt(reference, label) {
  if (!reference?.path || !reference?.checksum) throw new Error(`${label} receipt reference is incomplete.`);
  const checksum = await checksumFromSidecar(reference.path);
  if (checksum !== reference.checksum) throw new Error(`${label} receipt checksum does not match the resolved release contract.`);
  return readJsonReceipt(reference.path);
}

async function checksumFromSidecar(path) {
  const line = (await readFile(`${path}.sha256`, "utf8")).trim();
  return line.split(/\s+/u)[0] || "";
}

function readInteger(name, fallback, minimum, maximum) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function readBoolean(name, fallback) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes"].includes(value)) return true;
  if (["0", "false", "no"].includes(value)) return false;
  throw new Error(`${name} must be true or false.`);
}

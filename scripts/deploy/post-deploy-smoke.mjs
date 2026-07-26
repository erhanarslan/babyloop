#!/usr/bin/env node
import { Buffer } from "node:buffer";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { readReleaseManifest } from "../ops/release-ops-lib.mjs";
import {
  assessDeploymentReadiness,
  assertEnvironment,
  loadEnvFile,
  readJsonReceipt,
  required,
  runCommand,
  timestampForFile,
  writeJsonReceipt
} from "./deployment-lib.mjs";
import { RELEASE_EVIDENCE_SCHEMA_VERSION, summarizeSamples } from "./release-evidence-lib.mjs";

const envFile = required(process.env.DEPLOY_ENV_FILE, "DEPLOY_ENV_FILE");
const { values } = await loadEnvFile(envFile);
const environment = assertEnvironment(process.env.DEPLOY_ENVIRONMENT || values.DEPLOY_ENVIRONMENT);
const apiUrl = stripTrailingSlash(process.env.DEPLOY_API_URL || values.NEXT_PUBLIC_API_BASE_URL);
const webUrl = stripTrailingSlash(process.env.DEPLOY_WEB_URL || values.NEXT_PUBLIC_SITE_URL);
const backofficeUrl = stripTrailingSlash(process.env.DEPLOY_BACKOFFICE_URL || values.NEXT_PUBLIC_BACKOFFICE_BASE_URL);
const metricsToken = process.env.OBSERVABILITY_METRICS_TOKEN || values.OBSERVABILITY_METRICS_TOKEN;
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

for (const [name, value] of [["api", apiUrl], ["web", webUrl], ["backoffice", backofficeUrl]]) {
  if (!value || !value.startsWith("https://")) throw new Error(`${name} smoke URL must use HTTPS.`);
}

const release = await resolveRelease();
const probes = {};
const warnings = [];
const cloudRunDeploymentReceiptPath = resolve(
  process.env.DEPLOY_CLOUD_RUN_RECEIPT_PATH
    || `.release/gcp/${environment}/cloud-run-deployment-services.json`
);
const cloudRunDeploymentReceipt = await readJsonReceipt(
  cloudRunDeploymentReceiptPath,
  { optional: true }
);
let workerBootstrap = {
  active: false,
  blockingDependencies: [],
  deploymentReceiptPath: cloudRunDeploymentReceipt ? cloudRunDeploymentReceiptPath : null
};

function validateApiReadiness({ body }) {
  const coreReady = body?.dependencies?.database?.status === "ready"
    && body?.dependencies?.schema?.status === "ready"
    && body?.dependencies?.storage?.status === "ready"
    && (!values.RAG_ENABLED || values.RAG_ENABLED !== "true"
      || body?.dependencies?.ragVectorStore?.status === "ready")
    && (!values.RAG_REDIS_ENABLED || values.RAG_REDIS_ENABLED !== "true"
      || body?.dependencies?.ragRedis?.status === "ready");
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
      deploymentReceiptPath: cloudRunDeploymentReceiptPath,
      graceAgeSeconds: assessment.graceAgeSeconds,
      graceExpiresAt: assessment.graceExpiresAt
    };
  }
  return assessment.ready;
}

await waitFor("api-liveness", `${apiUrl}/health/live`, {
  attempts,
  delayMs,
  timeoutMs,
  parseJson: true,
  validate: ({ body }) => body?.live === true
});
await waitFor("api-readiness", `${apiUrl}/health/ready`, {
  attempts,
  acceptedStatuses: [200, 503],
  delayMs,
  timeoutMs,
  parseJson: true,
  validate: validateApiReadiness
});
if (workerBootstrap.active) {
  warnings.push(
    `Worker heartbeat bootstrap grace is active for ${workerBootstrap.blockingDependencies.join(", ")} until ${workerBootstrap.graceExpiresAt}.`
  );
}

const performanceProbes = [
  {
    name: "api-liveness",
    url: `${apiUrl}/health/live`,
    kind: "json",
    validate: ({ body }) => body?.live === true
  },
  {
    name: "api-readiness",
    url: `${apiUrl}/health/ready`,
    kind: "json",
    acceptedStatuses: [200, 503],
    validate: validateApiReadiness
  },
  {
    name: "api-openapi",
    url: `${apiUrl}/docs/json`,
    kind: "json",
    validate: ({ body }) => String(body?.openapi || "").startsWith("3.")
  },
  {
    name: "api-capabilities",
    url: `${apiUrl}/api/v1/meta/capabilities`,
    kind: "json",
    validate: ({ body }) => body?.ok === true
      && body?.data?.modules?.marketplace === true
      && body?.data?.modules?.analytics === true
  },
  {
    name: "api-categories",
    url: `${apiUrl}/api/v1/categories`,
    kind: "json",
    validate: ({ body, headers }) => body?.ok === true && Array.isArray(body?.data?.categories)
      && String(headers["cache-control"] || "").includes("max-age=300")
  },
  {
    name: "api-listings",
    url: `${apiUrl}/api/v1/listings?hasImages=true&imageLimit=1&includeTotal=false&limit=20&offset=0&sort=newest`,
    kind: "json",
    validate: ({ body }) => body?.ok === true && Array.isArray(body?.data?.listings)
      && body?.data?.pagination?.total === null
  },
  {
    name: "web-home",
    url: webUrl,
    kind: "html",
    requiredHeaders: ["content-security-policy", "x-content-type-options"]
  },
  {
    name: "web-login",
    url: `${webUrl}/login`,
    kind: "html",
    requiredHeaders: ["content-security-policy", "x-content-type-options"]
  },
  {
    name: "web-browse",
    url: `${webUrl}/browse`,
    kind: "html",
    requiredHeaders: ["content-security-policy", "x-content-type-options"]
  },
  {
    name: "backoffice-login",
    url: `${backofficeUrl}/login`,
    kind: "html",
    requiredHeaders: ["content-security-policy", "x-content-type-options"]
  }
];

for (const definition of performanceProbes) {
  probes[definition.name] = await sampleProbe(definition, sampleCount);
  const byteLimit = definition.kind === "html" ? maxHtmlBytes : maxJsonBytes;
  if (probes[definition.name].summary.p95Ms > maxP95Ms) {
    warnings.push(`${definition.name} p95 ${probes[definition.name].summary.p95Ms}ms exceeds ${maxP95Ms}ms.`);
  }
  if (probes[definition.name].summary.maxBytes > byteLimit) {
    warnings.push(`${definition.name} response ${probes[definition.name].summary.maxBytes} bytes exceeds ${byteLimit}.`);
  }
}

const contractProbes = [
  ["web-privacy", `${webUrl}/legal/privacy`],
  ["web-kvkk", `${webUrl}/legal/kvkk`],
  ["web-terms", `${webUrl}/legal/terms`],
  ["web-cookies", `${webUrl}/legal/cookies`],
  ["web-ai-notice", `${webUrl}/legal/ai-notice`],
  ["web-marketplace", `${webUrl}/legal/marketplace`],
  ["web-data-deletion", `${webUrl}/legal/data-deletion`],
  ["web-support", `${webUrl}/support/contact`]
];
for (const [name, url] of contractProbes) {
  probes[name] = await sampleProbe({
    name,
    url,
    kind: "html",
    requiredHeaders: ["content-security-policy", "x-content-type-options"]
  }, 1);
}

if (metricsToken) {
  const metrics = await request(`${apiUrl}/internal/metrics`, {
    headers: { authorization: `Bearer ${metricsToken}` },
    timeoutMs,
    parseJson: false
  });
  if (!metrics.text.includes("babyloop_")) throw new Error("Metrics endpoint returned no BabyLoop metrics.");
  probes.metrics = {
    samples: [publicSample(metrics)],
    summary: summarizeSamples([metrics]),
    url: `${apiUrl}/internal/metrics`
  };
}

if (warnings.length > 0 && enforcePerformance) {
  throw new Error(`Deployment acceptance performance thresholds failed:\n- ${warnings.join("\n- ")}`);
}

const createdAt = new Date().toISOString();
const evidencePath = resolve(process.env.DEPLOY_ACCEPTANCE_EVIDENCE_PATH
  || `.release/evidence/${environment}-acceptance-${timestampForFile(new Date(createdAt))}.json`);
const evidence = {
  schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
  kind: "deployment_acceptance",
  status: "passed",
  createdAt,
  environment,
  gitSha: release.gitSha,
  release,
  endpoints: { api: apiUrl, web: webUrl, backoffice: backofficeUrl },
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
    emailDeliveryMode: values.EMAIL_DELIVERY_MODE || "unset",
    emailProvider: values.EMAIL_PROVIDER || "unset",
    providerCallsAllowed: values.PROVIDER_CALLS_ALLOWED === "true",
    ragCollection: values.RAG_ENABLED === "true" ? values.RAG_QDRANT_COLLECTION : null,
    redisKeyPrefix: values.RAG_REDIS_ENABLED === "true" ? values.RAG_REDIS_KEY_PREFIX : null,
    storageDriver: values.IMAGE_STORAGE_DRIVER || "unset"
  },
  workerBootstrap,
  probes,
  warnings
};


const receipt = await writeJsonReceipt(evidencePath, evidence);
process.stdout.write(`${JSON.stringify({
  ok: true,
  environment,
  evidencePath: receipt.path,
  checksum: receipt.checksum,
  gitSha: release.gitSha,
  releaseId: release.releaseId,
  warnings
}, null, 2)}\n`);

async function resolveRelease() {
  const manifestPath = process.env.DEPLOY_RELEASE_MANIFEST_PATH;
  if (manifestPath) {
    const { manifest } = await readReleaseManifest(manifestPath, { requireChecksum: true });
    return {
      manifestPath: resolve(manifestPath),
      releaseId: manifest.releaseId,
      gitSha: manifest.gitSha,
      migrationHead: manifest.database.migrationHead
    };
  }
  const gitSha = process.env.RELEASE_GIT_SHA || (await readGitHead());
  return {
    manifestPath: null,
    releaseId: `${environment}-standalone-${gitSha.slice(0, 12)}`,
    gitSha,
    migrationHead: "unknown"
  };
}

async function readGitHead() {
  const result = await runCommand("git", ["rev-parse", "HEAD"], { capture: true });
  const value = result.stdout.trim();
  if (!/^[a-f0-9]{40}$/u.test(value)) throw new Error("Unable to resolve git SHA for deployment acceptance.");
  return value;
}

async function sampleProbe(definition, count) {
  const samples = [];
  for (let index = 0; index < count; index += 1) {
    const result = await request(definition.url, {
      timeoutMs,
      acceptedStatuses: definition.acceptedStatuses,
      parseJson: definition.kind === "json"
    });
    if (definition.validate && !definition.validate(result)) {
      throw new Error(`${definition.name} response contract failed.`);
    }
    for (const header of definition.requiredHeaders || []) {
      if (!result.headers[header]) throw new Error(`${definition.name} is missing ${header}.`);
    }
    const contentType = result.headers["content-type"] || "";
    if (definition.kind === "json" && !contentType.includes("application/json")) {
      throw new Error(`${definition.name} did not return application/json.`);
    }
    if (definition.kind === "html" && !contentType.includes("text/html")) {
      throw new Error(`${definition.name} did not return text/html.`);
    }
    samples.push(result);
  }
  return {
    url: definition.url,
    samples: samples.map(publicSample),
    summary: summarizeSamples(samples)
  };
}

async function waitFor(name, url, options) {
  let lastError;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const result = await request(url, options);
      if (options.validate && !options.validate(result)) throw new Error(`${name} response contract failed.`);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < options.attempts) await new Promise((resolvePromise) => setTimeout(resolvePromise, options.delayMs));
    }
  }
  throw new Error(`${name} smoke failed after ${options.attempts} attempts: ${lastError instanceof Error ? lastError.message : "unknown"}`);
}

async function request(url, options) {
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
      throw new Error(`${url} returned ${response.status}.`);
    }
    const text = await response.text();
    let body = null;
    if (options.parseJson !== false) {
      try { body = JSON.parse(text); } catch { throw new Error(`${url} did not return JSON.`); }
    }
    return {
      body,
      bytes: Buffer.byteLength(text),
      durationMs: performance.now() - startedAt,
      finalUrl: response.url,
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status,
      text
    };
  } finally {
    clearTimeout(timer);
  }
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

function stripTrailingSlash(value) { return String(value || "").trim().replace(/\/+$/u, ""); }
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

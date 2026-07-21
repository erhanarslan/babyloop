import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

export const RELEASE_EVIDENCE_SCHEMA_VERSION = 1;
export const MOBILE_RELEASE_CHECKS = [
  "coldStart",
  "passwordLogin",
  "mfaOtp",
  "loginApprovalPush",
  "sessionRevocation",
  "listingBrowsePagination",
  "listingCreateEditImages",
  "favorites",
  "messagingRealtime",
  "notificationReadState",
  "childNotebookReminder",
  "assistantSafety",
  "basketCheckoutSimulation",
  "backgroundForegroundRecovery",
  "longScrollMemory"
];
export const PROVIDER_PROBE_CHECKS = [
  "apiReadiness",
  "databaseReadiness",
  "storageReadiness",
  "qdrantReadiness",
  "redisReadiness",
  "notificationWorkerReadiness",
  "childReminderWorkerReadiness",
  "r2RoundTrip",
  "notificationDelivery",
  "ragAcceptance",
  "analyticsDatabase"
];
export const PROVIDER_RELEASE_CHECKS = [
  "postgresReadWrite",
  "backupReplica",
  "emailDelivery",
  "imageStorageUploadReadDelete",
  "pushDelivery",
  "qdrantRetrieval",
  "redisConnectivity",
  "analyticsIngest",
  "notificationWorkerHeartbeat",
  "childReminderWorkerHeartbeat",
  "errorWebhook"
];

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function percentile(values, quantile) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].map(Number).sort((a, b) => a - b);
  const bounded = Math.min(1, Math.max(0, Number(quantile)));
  const index = Math.max(0, Math.ceil(sorted.length * bounded) - 1);
  return sorted[index];
}

export function summarizeSamples(samples) {
  const durations = samples.map((sample) => Number(sample.durationMs));
  const bytes = samples.map((sample) => Number(sample.bytes));
  return {
    count: samples.length,
    p50Ms: round(percentile(durations, 0.5)),
    p95Ms: round(percentile(durations, 0.95)),
    maxMs: round(Math.max(...durations, 0)),
    maxBytes: Math.max(...bytes, 0),
    statuses: [...new Set(samples.map((sample) => sample.status))].sort((a, b) => a - b)
  };
}

export function assertEvidence(value, expectedKind) {
  if (!value || typeof value !== "object") throw new Error("Release evidence must be a JSON object.");
  if (value.schemaVersion !== RELEASE_EVIDENCE_SCHEMA_VERSION) {
    throw new Error(`Unsupported release evidence schema version: ${value.schemaVersion ?? "missing"}.`);
  }
  if (typeof value.kind !== "string" || !value.kind) throw new Error("Release evidence kind is missing.");
  if (expectedKind && value.kind !== expectedKind) {
    throw new Error(`Expected ${expectedKind} evidence but received ${value.kind}.`);
  }
  if (typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) {
    throw new Error("Release evidence createdAt is invalid.");
  }
  if (typeof value.gitSha !== "string" || !/^[a-f0-9]{40}$/u.test(value.gitSha)) {
    throw new Error("Release evidence gitSha must be a full 40-character lowercase SHA.");
  }

  switch (value.kind) {
    case "deployment_acceptance":
      if (!["staging", "production"].includes(value.environment)) throw new Error("Deployment acceptance environment must be staging or production.");
      if (value.status !== "passed") throw new Error("Deployment acceptance evidence did not pass.");
      if (!value.release || value.release.gitSha !== value.gitSha) {
        throw new Error("Deployment acceptance release metadata does not match gitSha.");
      }
      if (typeof value.release.manifestPath !== "string" || !value.release.manifestPath
        || typeof value.release.releaseId !== "string" || !value.release.releaseId
        || typeof value.release.migrationHead !== "string" || !value.release.migrationHead
        || value.release.migrationHead === "unknown") {
        throw new Error("Deployment acceptance must be tied to a release manifest and migration head.");
      }
      if (!value.probes || typeof value.probes !== "object") throw new Error("Deployment acceptance probes are missing.");
      break;
    case "restore_smoke":
      if (value.status !== "passed") throw new Error("Restore-smoke evidence did not pass.");
      if (!value.sourceDatabase || !value.targetDatabase) throw new Error("Restore-smoke database metadata is missing.");
      break;
    case "mobile_release_evidence":
      assertChecks(value.checks, MOBILE_RELEASE_CHECKS, "mobile");
      if (!value.device || !value.osVersion || !value.buildId || !value.tester) {
        throw new Error("Mobile evidence device, osVersion, buildId, and tester are required.");
      }
      break;
    case "container_image_manifest":
      if (value.status !== "ready") throw new Error("Container image manifest is not ready.");
      if (!["staging", "production"].includes(value.environment)) {
        throw new Error("Container image manifest environment must be staging or production.");
      }
      for (const name of ["api", "web", "backoffice"]) {
        if (typeof value.images?.[name] !== "string"
          || !/^[^\s]+@sha256:[a-f0-9]{64}$/u.test(value.images[name])) {
          throw new Error(`Container image manifest ${name} image is invalid.`);
        }
      }
      break;
    case "runtime_env_audit":
      if (value.status !== "passed") throw new Error("Runtime env audit did not pass.");
      if (!["staging", "production"].includes(value.environment)) {
        throw new Error("Runtime env audit environment must be staging or production.");
      }
      if (!/^[a-f0-9]{64}$/u.test(value.contractSha256 || "")) {
        throw new Error("Runtime env audit contractSha256 is invalid.");
      }
      if (!value.sourceEnvFile || !Number.isInteger(value.keyCount) || !Number.isInteger(value.secretKeyCount)) {
        throw new Error("Runtime env audit metadata is incomplete.");
      }
      break;
    case "staging_bootstrap_plan":
      if (value.status !== "ready" || value.environment !== "staging") {
        throw new Error("Staging bootstrap plan must be ready for staging.");
      }
      if (!value.runtimeEnvAudit || !/^[a-f0-9]{64}$/u.test(value.runtimeEnvAudit.sha256 || "")) {
        throw new Error("Staging bootstrap plan runtime env audit reference is invalid.");
      }
      if (!value.imageManifest || !/^[a-f0-9]{64}$/u.test(value.imageManifest.sha256 || "")) {
        throw new Error("Staging bootstrap plan image manifest reference is invalid.");
      }
      for (const name of ["api", "web", "backoffice"]) {
        if (typeof value.images?.[name] !== "string" || !value.images[name].includes("@sha256:")) {
          throw new Error(`Staging bootstrap image ${name} is invalid.`);
        }
      }
      for (const name of ["web", "api", "backoffice"]) {
        if (typeof value.domains?.[name] !== "string" || !value.domains[name]) {
          throw new Error(`Staging bootstrap domain ${name} is invalid.`);
        }
      }
      if (!/^[a-f0-9]{64}$/u.test(value.composeSha256 || "")
        || !/^[a-f0-9]{64}$/u.test(value.proxySha256 || "")) {
        throw new Error("Staging bootstrap compose/proxy checksum is invalid.");
      }
      break;
    case "provider_probe_evidence":
      if (value.status !== "passed" || value.mode !== "live") {
        throw new Error("Provider probe evidence must be a passed live run.");
      }
      if (!["staging", "production"].includes(value.environment)) {
        throw new Error("Provider probe environment must be staging or production.");
      }
      assertChecks(value.checks, PROVIDER_PROBE_CHECKS, "provider probe");
      break;
    case "provider_release_evidence":
      assertChecks(value.checks, PROVIDER_RELEASE_CHECKS, "provider");
      if (!value.environment || !["staging", "production"].includes(value.environment)) {
        throw new Error("Provider evidence environment must be staging or production.");
      }
      break;
    case "production_go_no_go":
      if (value.environment !== "production" || value.decision !== "GO") {
        throw new Error("Production go/no-go evidence must contain decision=GO for production.");
      }
      if (!value.inputs || typeof value.inputs !== "object") throw new Error("Production go/no-go inputs are missing.");
      for (const name of [
        "runtimeEnvAudit",
        "bootstrapPlan",
        "providerProbe",
        "stagingAcceptance",
        "restoreSmoke",
        "mobile",
        "providers"
      ]) {
        const input = value.inputs[name];
        if (!input || typeof input.path !== "string" || typeof input.kind !== "string"
          || typeof input.createdAt !== "string" || !/^[a-f0-9]{64}$/u.test(input.sha256 || "")) {
          throw new Error(`Production go/no-go input ${name} is invalid.`);
        }
      }
      break;
    default:
      throw new Error(`Unsupported release evidence kind: ${value.kind}.`);
  }

  return value;
}

export function assertFreshEvidence(value, options = {}) {
  const maxAgeHours = Number(options.maxAgeHours ?? 72);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error("maxAgeHours must be positive.");
  const nowMs = options.nowMs ?? Date.now();
  const ageMs = nowMs - Date.parse(value.createdAt);
  if (ageMs < -5 * 60 * 1000) throw new Error("Release evidence was created in the future.");
  if (ageMs > maxAgeHours * 60 * 60 * 1000) {
    throw new Error(`Release evidence is older than ${maxAgeHours} hours.`);
  }
  return value;
}

export async function readChecksummedEvidence(path, options = {}) {
  const resolvedPath = resolve(path);
  const content = await readFile(resolvedPath, "utf8");
  const checksumContent = (await readFile(`${resolvedPath}.sha256`, "utf8")).trim();
  const [expected, fileName] = checksumContent.split(/\s+/u);
  const actual = sha256Text(content);
  if (expected !== actual) throw new Error(`Release evidence checksum mismatch: ${resolvedPath}`);
  if (fileName && fileName !== basename(resolvedPath)) {
    throw new Error(`Release evidence checksum filename mismatch: ${resolvedPath}`);
  }
  const evidence = assertEvidence(JSON.parse(content), options.kind);
  if (options.maxAgeHours) assertFreshEvidence(evidence, { maxAgeHours: options.maxAgeHours, nowMs: options.nowMs });
  if (options.gitSha && evidence.gitSha !== options.gitSha) {
    throw new Error(`Release evidence gitSha mismatch: expected ${options.gitSha}, received ${evidence.gitSha}.`);
  }
  return { content, evidence, path: resolvedPath, sha256: actual };
}

function assertChecks(checks, requiredChecks, label) {
  if (!checks || typeof checks !== "object") throw new Error(`${label} release checks are missing.`);
  const missing = requiredChecks.filter((name) => checks[name] !== true);
  if (missing.length > 0) throw new Error(`${label} release checks are incomplete: ${missing.join(", ")}`);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

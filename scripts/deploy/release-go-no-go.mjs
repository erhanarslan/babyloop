#!/usr/bin/env node
import { resolve } from "node:path";
import { runCommand, timestampForFile, writeJsonReceipt } from "./deployment-lib.mjs";
import { RELEASE_EVIDENCE_SCHEMA_VERSION, readChecksummedEvidence } from "./release-evidence-lib.mjs";

const gitSha = process.env.GO_NO_GO_GIT_SHA || (await gitHead());
const maxAgeHours = parsePositiveNumber(process.env.GO_NO_GO_MAX_AGE_HOURS, 72);
const runtimeEnvAudit = await readChecksummedEvidence(requiredEnv("GO_NO_GO_RUNTIME_ENV_AUDIT_PATH"), {
  kind: "runtime_env_audit",
  gitSha,
  maxAgeHours
});
if (runtimeEnvAudit.evidence.environment !== "staging") {
  throw new Error("GO_NO_GO_RUNTIME_ENV_AUDIT_PATH must point to staging runtime env audit evidence.");
}
const bootstrapPlan = await readChecksummedEvidence(requiredEnv("GO_NO_GO_BOOTSTRAP_PLAN_PATH"), {
  kind: "staging_bootstrap_plan",
  gitSha,
  maxAgeHours
});
const providerProbe = await readChecksummedEvidence(requiredEnv("GO_NO_GO_PROVIDER_PROBE_PATH"), {
  kind: "provider_probe_evidence",
  gitSha,
  maxAgeHours
});
if (providerProbe.evidence.environment !== "staging") {
  throw new Error("GO_NO_GO_PROVIDER_PROBE_PATH must point to staging provider probe evidence.");
}
if (bootstrapPlan.evidence.runtimeEnvAudit.sha256 !== runtimeEnvAudit.sha256) {
  throw new Error("Staging bootstrap plan does not reference the supplied runtime env audit checksum.");
}
const stagingAcceptance = await readChecksummedEvidence(requiredEnv("GO_NO_GO_STAGING_ACCEPTANCE_PATH"), {
  kind: "deployment_acceptance",
  gitSha,
  maxAgeHours
});
if (stagingAcceptance.evidence.environment !== "staging") {
  throw new Error("GO_NO_GO_STAGING_ACCEPTANCE_PATH must point to staging deployment acceptance evidence.");
}
const restoreSmoke = await readChecksummedEvidence(requiredEnv("GO_NO_GO_RESTORE_SMOKE_PATH"), {
  kind: "restore_smoke",
  gitSha,
  maxAgeHours
});
const mobile = await readChecksummedEvidence(requiredEnv("GO_NO_GO_MOBILE_EVIDENCE_PATH"), {
  kind: "mobile_release_evidence",
  gitSha,
  maxAgeHours
});
const providers = await readChecksummedEvidence(requiredEnv("GO_NO_GO_PROVIDER_EVIDENCE_PATH"), {
  kind: "provider_release_evidence",
  gitSha,
  maxAgeHours
});
if (providers.evidence.environment !== "staging") {
  throw new Error("Provider release evidence must be collected against staging before production GO.");
}
if (providerProbe.evidence.environment !== providers.evidence.environment) {
  throw new Error("Automated provider probe and manual provider evidence environments do not match.");
}

const createdAt = new Date().toISOString();
const outputPath = resolve(process.env.GO_NO_GO_OUTPUT_PATH
  || `.release/evidence/production-go-${timestampForFile(new Date(createdAt))}-${gitSha.slice(0, 12)}.json`);
const evidence = {
  schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
  kind: "production_go_no_go",
  decision: "GO",
  environment: "production",
  createdAt,
  gitSha,
  maxAgeHours,
  inputs: {
    runtimeEnvAudit: summarize(runtimeEnvAudit),
    bootstrapPlan: summarize(bootstrapPlan),
    providerProbe: summarize(providerProbe),
    stagingAcceptance: summarize(stagingAcceptance),
    restoreSmoke: summarize(restoreSmoke),
    mobile: summarize(mobile),
    providers: summarize(providers)
  }
};
const receipt = await writeJsonReceipt(outputPath, evidence);
process.stdout.write(`${JSON.stringify({ ok: true, decision: "GO", outputPath: receipt.path, checksum: receipt.checksum, gitSha }, null, 2)}\n`);

function summarize(result) {
  return {
    path: result.path,
    kind: result.evidence.kind,
    createdAt: result.evidence.createdAt,
    sha256: result.sha256
  };
}
async function gitHead() {
  const result = await runCommand("git", ["rev-parse", "HEAD"], { capture: true });
  const value = result.stdout.trim();
  if (!/^[a-f0-9]{40}$/u.test(value)) throw new Error("git rev-parse HEAD did not return a full SHA.");
  return value;
}
function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function parsePositiveNumber(value, fallback) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("GO_NO_GO_MAX_AGE_HOURS must be positive.");
  return parsed;
}

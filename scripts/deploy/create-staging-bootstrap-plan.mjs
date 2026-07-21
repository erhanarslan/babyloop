#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  assertDigestImage,
  assertEnvironment,
  loadEnvFile,
  mergedEnvironment,
  required,
  runCommand,
  timestampForFile,
  writeJsonReceipt
} from "./deployment-lib.mjs";
import { readChecksummedEvidence, RELEASE_EVIDENCE_SCHEMA_VERSION } from "./release-evidence-lib.mjs";

const releaseEnvPath = resolve(readArg("--release-env") || required(process.env.DEPLOY_RELEASE_ENV_FILE, "DEPLOY_RELEASE_ENV_FILE"));
const releaseEnv = await loadEnvFile(releaseEnvPath);
const environment = assertEnvironment(releaseEnv.values.DEPLOY_ENVIRONMENT);
if (environment !== "staging") throw new Error("Staging bootstrap plan requires DEPLOY_ENVIRONMENT=staging.");

const gitSha = releaseEnv.values.DEPLOY_GIT_SHA || await gitHead();
if (!/^[a-f0-9]{40}$/u.test(gitSha)) throw new Error("DEPLOY_GIT_SHA must be a full lowercase 40-character SHA.");
const currentGitSha = await gitHead();
if (gitSha !== currentGitSha) throw new Error(`DEPLOY_GIT_SHA ${gitSha} does not match current HEAD ${currentGitSha}.`);

const runtimeEnvFile = resolve(required(releaseEnv.values.DEPLOY_ENV_FILE, "DEPLOY_ENV_FILE"));
const runtimeAuditPath = resolve(required(
  releaseEnv.values.RUNTIME_ENV_AUDIT_EVIDENCE_PATH,
  "RUNTIME_ENV_AUDIT_EVIDENCE_PATH"
));
const runtimeAudit = await readChecksummedEvidence(runtimeAuditPath, {
  kind: "runtime_env_audit",
  gitSha,
  maxAgeHours: Number(releaseEnv.values.GO_NO_GO_MAX_AGE_HOURS || 72)
});
if (runtimeAudit.evidence.environment !== "staging") throw new Error("Runtime env audit must target staging.");
if (runtimeAudit.evidence.sourceEnvFile !== basename(runtimeEnvFile)) {
  throw new Error("Runtime env audit source file does not match DEPLOY_ENV_FILE.");
}

const imageManifestPath = resolve(required(releaseEnv.values.IMAGE_MANIFEST_PATH, "IMAGE_MANIFEST_PATH"));
const imageManifest = await readChecksummedEvidence(imageManifestPath, {
  kind: "container_image_manifest",
  gitSha,
  maxAgeHours: Number(releaseEnv.values.GO_NO_GO_MAX_AGE_HOURS || 72)
});
if (imageManifest.evidence.environment !== "staging") {
  throw new Error("IMAGE_MANIFEST_PATH must point to a staging container image manifest.");
}
const images = {
  api: assertDigestImage(imageManifest.evidence.images.api, "API_IMAGE"),
  web: assertDigestImage(imageManifest.evidence.images.web, "WEB_IMAGE"),
  backoffice: assertDigestImage(imageManifest.evidence.images.backoffice, "BACKOFFICE_IMAGE")
};
const domains = {
  web: assertHostname(required(releaseEnv.values.WEB_DOMAIN, "WEB_DOMAIN"), "WEB_DOMAIN"),
  api: assertHostname(required(releaseEnv.values.API_DOMAIN, "API_DOMAIN"), "API_DOMAIN"),
  backoffice: assertHostname(required(releaseEnv.values.BACKOFFICE_DOMAIN, "BACKOFFICE_DOMAIN"), "BACKOFFICE_DOMAIN")
};
if (new Set(Object.values(domains)).size !== 3) throw new Error("WEB_DOMAIN, API_DOMAIN and BACKOFFICE_DOMAIN must be distinct.");

const composeFile = resolve(releaseEnv.values.DEPLOY_COMPOSE_FILE || "deploy/compose/docker-compose.runtime.yml");
const proxyFile = resolve(releaseEnv.values.DEPLOY_PROXY_FILE || "deploy/proxy/Caddyfile.example");
const composeSha256 = await sha256File(composeFile);
const proxySha256 = await sha256File(proxyFile);
const commandEnv = mergedEnvironment(releaseEnv.values, {
  DEPLOY_ENV_FILE: runtimeEnvFile,
  DEPLOY_ENVIRONMENT: environment,
  API_IMAGE: images.api,
  WEB_IMAGE: images.web,
  BACKOFFICE_IMAGE: images.backoffice
});

if (readArg("--skip-docker") !== "true") {
  await runCommand("docker", ["compose", "--env-file", releaseEnvPath, "-f", composeFile, "config", "--quiet"], {
    env: commandEnv
  });
}

const createdAt = new Date().toISOString();
const outputPath = resolve(
  readArg("--output")
  || releaseEnv.values.STAGING_BOOTSTRAP_PLAN_PATH
  || `.release/evidence/staging-bootstrap-plan-${timestampForFile(new Date(createdAt))}-${gitSha.slice(0, 12)}.json`
);
const evidence = {
  schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
  kind: "staging_bootstrap_plan",
  status: "ready",
  createdAt,
  gitSha,
  environment,
  runtimeEnvAudit: {
    path: runtimeAudit.path,
    sha256: runtimeAudit.sha256
  },
  imageManifest: {
    path: imageManifest.path,
    sha256: imageManifest.sha256
  },
  sourceReleaseEnvFile: basename(releaseEnvPath),
  sourceRuntimeEnvFile: basename(runtimeEnvFile),
  composeFile,
  composeSha256,
  proxyFile,
  proxySha256,
  images,
  domains,
  bind: {
    api: `${releaseEnv.values.API_BIND_ADDRESS || "127.0.0.1"}:${releaseEnv.values.API_BIND_PORT || "4000"}`,
    web: `${releaseEnv.values.WEB_BIND_ADDRESS || "127.0.0.1"}:${releaseEnv.values.WEB_BIND_PORT || "3000"}`,
    backoffice: `${releaseEnv.values.BACKOFFICE_BIND_ADDRESS || "127.0.0.1"}:${releaseEnv.values.BACKOFFICE_BIND_PORT || "3001"}`
  },
  execution: {
    confirmation: "DEPLOY_STAGING",
    command: "pnpm deploy:staging:execute",
    acceptanceCommand: "pnpm deploy:acceptance",
    providerProbeCommand: "pnpm deploy:providers:probe"
  }
};
const receipt = await writeJsonReceipt(outputPath, evidence);
process.stdout.write(`${JSON.stringify({
  ok: true,
  status: "ready",
  environment,
  gitSha,
  outputPath: receipt.path,
  checksum: receipt.checksum,
  images,
  domains
}, null, 2)}\n`);

async function gitHead() {
  const result = await runCommand("git", ["rev-parse", "HEAD"], { capture: true });
  const value = result.stdout.trim();
  if (!/^[a-f0-9]{40}$/u.test(value)) throw new Error("git rev-parse HEAD did not return a full SHA.");
  return value;
}
async function sha256File(path) {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex");
}
function assertHostname(value, name) {
  const normalized = String(value).trim().toLowerCase();
  if (!/^(?=.{1,253}$)(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/u.test(normalized)) {
    throw new Error(`${name} must be a DNS hostname.`);
  }
  if (/localhost|example$/u.test(normalized)) throw new Error(`${name} still looks like a placeholder.`);
  return normalized;
}
function readArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

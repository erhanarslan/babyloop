#!/usr/bin/env node
import { access, appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readJsonReceipt, writeJsonReceipt } from "./deployment-lib.mjs";
import { validateResolvedReleaseContract } from "./release-orchestration-lib.mjs";

const environment = String(process.env.DEPLOY_ENVIRONMENT || "").trim().toLowerCase();
const contractPath = resolve(
  process.env.DEPLOY_RELEASE_CONTRACT_PATH
    || `.release/gcp/${environment}/resolved-release-contract.json`
);
const contract = validateResolvedReleaseContract(await readJsonReceipt(contractPath), environment);
const smokePath = contract.artifacts.smokeEvidence.path;
const smoke = await readJsonReceipt(smokePath);
if (smoke.gitSha !== contract.gitSha || smoke.environment !== environment) {
  throw new Error("Smoke evidence does not match the resolved release contract.");
}
if (!new Set(["passed", "passed_with_warnings"]).has(smoke.status)) {
  throw new Error("Smoke evidence is not successful.");
}
const smokeChecksum = await checksumFromSidecar(smokePath);
const openApi = validateOpenApiOutcome(smoke.openApi);
await validateArtifactInventory(contract);

const metadata = {
  schemaVersion: 1,
  kind: "immutable_deployment_metadata",
  status: smoke.status === "passed_with_warnings" ? "passed_with_warnings" : "passed",
  createdAt: new Date().toISOString(),
  environment,
  gitSha: contract.gitSha,
  project: contract.project,
  region: contract.region,
  images: contract.images,
  services: contract.services,
  migration: contract.migration,
  databasePostflight: contract.databasePostflight,
  smoke: { path: smokePath, checksum: smokeChecksum, status: smoke.status },
  releaseContract: { path: contractPath, checksum: await checksumFromSidecar(contractPath) },
  acceptance: smoke.acceptance || null,
  openApi,
  warningCategories: {
    performance: smoke.performanceWarnings?.length || 0,
    optionalPublicSurfaces: smoke.optionalPublicSurfaceWarnings?.length || 0,
    workerBootstrap: smoke.workerBootstrapWarnings?.length || 0
  },
  warnings: smoke.warnings || [],
  artifactInventoryVerified: true
};
const receipt = await writeJsonReceipt(contract.artifacts.metadata.path, metadata);

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    `### ${environment === "production" ? "Promoted" : "Staging"} immutable release`,
    "",
    `- Release contract: \`${contractPath}\``,
    `- Git SHA: \`${contract.gitSha}\``,
    `- Smoke status: \`${metadata.status}\``,
    `- OpenAPI probe: \`${metadata.openApi.status}\``,
    ...Object.entries(contract.images).map(([key, image]) => `- ${key}: \`${image}\``),
    `- Migration: \`${contract.migration.status}\``,
    `- Artifact inventory: \`verified\``
  ];
  if (metadata.warnings.length > 0) {
    lines.push(`- Smoke warnings: \`${metadata.warnings.length}\``);
  }
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, "utf8");
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  environment,
  status: metadata.status,
  metadataPath: receipt.path,
  checksum: receipt.checksum,
  warnings: metadata.warnings.length
}, null, 2)}\n`);

async function validateArtifactInventory(value) {
  for (const path of value.artifacts.requiredReferences || []) {
    await access(path);
    await access(`${path}.sha256`);
  }
  await access(value.backup.manifestPath);
  await access(resolve(value.backup.directory, value.backup.artifact));
  for (const root of value.artifacts.uploadRoots || []) await access(root);
}

async function checksumFromSidecar(path) {
  return (await readFile(`${path}.sha256`, "utf8")).trim().split(/\s+/u)[0];
}

function validateOpenApiOutcome(value) {
  if (!new Set(["passed", "skipped_runtime_disabled", "failed"]).has(value?.status)) {
    throw new Error("Smoke evidence OpenAPI outcome is missing or invalid.");
  }
  return {
    status: value.status,
    enabled: value.enabled === true,
    accessMode: String(value.accessMode || "unknown")
  };
}

#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvFile, readJsonReceipt, writeJsonReceipt } from "./deployment-lib.mjs";
import {
  assembleResolvedReleaseContract,
  assertServiceUrlReadBack,
  buildProtectedReference
} from "./release-orchestration-lib.mjs";
import { buildServiceDescribeArgs } from "../gcp/deploy-cloud-run.mjs";
import {
  artifactRoot,
  assertEnvironment,
  gcloud,
  loadCloudRunContract,
  parseFlag,
  safeMessage
} from "../gcp/cloud-run-lib.mjs";

export async function resolveReleaseContract(options = {}) {
  const environment = assertEnvironment(options.environment || parseFlag("environment"));
  const configuredEnvFile = options.envFile || parseFlag("env-file") || process.env.DEPLOY_ENV_FILE || "";
  if (!options.envValues && !configuredEnvFile) throw new Error("--env-file is required.");
  const envFile = configuredEnvFile ? resolve(configuredEnvFile) : "";
  const { contract: cloudRunContract, sha256: cloudRunContractSha256 } = options.cloudRunContract
    ? { contract: options.cloudRunContract, sha256: options.cloudRunContractSha256 }
    : await loadCloudRunContract();
  const root = artifactRoot(cloudRunContract, environment);
  const values = options.envValues || (await loadEnvFile(envFile)).values;
  const paths = {
    imageManifest: resolve(root, "cloud-run-image-manifest.json"),
    secretManifest: resolve(root, "secret-manifest.json"),
    migration: resolve(root, "cloud-run-migration.json"),
    deployment: resolve(root, "cloud-run-deployment-services.json"),
    runtimeAudit: resolve(root, "runtime-env-audit.json"),
    databasePreflight: resolve(root, "database-preflight.json"),
    databasePostflight: resolve(root, "database-postflight.json"),
    rollbackSnapshot: resolve(root, "cloud-run-rollback-snapshot.json"),
    ...(options.paths || {})
  };

  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [
    key,
    await readProtectedReceipt(path, key)
  ]));
  const protectedReceipts = Object.fromEntries(entries);
  const deploymentReceipt = protectedReceipts.deployment.value;
  assertReceiptContracts(protectedReceipts, {
    environment,
    project: cloudRunContract.projects[environment],
    gitSha: deploymentReceipt.gitSha
  });
  const describedUrls = options.describedUrls || await describeServiceUrls({
    cloudRunContract,
    environment,
    execute: options.execute || gcloud,
    skip: options.skipLiveReadback === true || parseFlag("skip-live-readback") === "true"
  });
  if (describedUrls) assertServiceUrlReadBack(deploymentReceipt.urls, describedUrls);
  else if (options.allowUnverifiedServiceUrls !== true && parseFlag("skip-live-readback") !== "true") {
    throw new Error("Cloud Run service URL read-back is required.");
  }

  const backup = options.backup || await findBackupManifest(
    process.env.BACKUP_OUTPUT_DIR || values.BACKUP_OUTPUT_DIR,
    environment,
    deploymentReceipt.gitSha,
    process.env.BACKUP_REPLICA_DIR || values.BACKUP_REPLICA_DIR
  );
  const references = Object.fromEntries(Object.entries(protectedReceipts).map(([key, entry]) => [
    key,
    entry.reference
  ]));
  const resolvedContract = assembleResolvedReleaseContract({
    environment,
    cloudRunContract,
    cloudRunContractSha256,
    gitSha: deploymentReceipt.gitSha,
    imageManifest: protectedReceipts.imageManifest.value,
    deploymentReceipt,
    migrationReceipt: protectedReceipts.migration.value,
    databasePostflightReceipt: protectedReceipts.databasePostflight.value,
    canonicalPublicUrls: {
      api: values.NEXT_PUBLIC_API_BASE_URL,
      web: values.NEXT_PUBLIC_SITE_URL,
      backoffice: values.NEXT_PUBLIC_BACKOFFICE_BASE_URL,
      requirePublicSurfaces: values.DEPLOY_REQUIRE_PUBLIC_SURFACES
    },
    references,
    rollbackSnapshot: protectedReceipts.rollbackSnapshot.value,
    backup
  });
  const outputPath = resolve(
    options.outputPath
      || parseFlag("output")
      || resolve(root, "resolved-release-contract.json")
  );
  const receipt = await writeJsonReceipt(outputPath, resolvedContract);
  return { contract: resolvedContract, receipt };
}

async function describeServiceUrls({ cloudRunContract, environment, execute, skip }) {
  if (skip) return null;
  const context = { project: cloudRunContract.projects[environment] };
  const described = {};
  for (const [key, config] of Object.entries(cloudRunContract.services)) {
    const result = await execute(buildServiceDescribeArgs({ config, context, contract: cloudRunContract }), {
      capture: true
    });
    described[key] = result.stdout.trim();
  }
  return described;
}

async function readProtectedReceipt(path, label) {
  let value;
  try {
    value = await readJsonReceipt(path);
  } catch (error) {
    throw new Error(`${label} receipt is missing, malformed, or failed checksum verification: ${safeMessage(error)}`, {
      cause: error
    });
  }
  const checksumLine = (await readFile(`${path}.sha256`, "utf8")).trim().split(/\s+/u);
  return {
    value,
    reference: buildProtectedReference(path, checksumLine[0])
  };
}

function assertReceiptContracts(receipts, expected) {
  const checks = [
    ["imageManifest", "gcp_cloud_run_image_manifest", "createdAt"],
    ["secretManifest", "gcp_secret_manifest", "createdAt"],
    ["migration", "gcp_cloud_run_migration", "completed"],
    ["deployment", "gcp_cloud_run_deployment", "deployed"],
    ["runtimeAudit", "runtime_env_audit", "passed"],
    ["databasePreflight", "database_release_preflight", "passed"],
    ["databasePostflight", "database_release_postflight", "passed"],
    ["rollbackSnapshot", "gcp_cloud_run_rollback_snapshot", "captured"]
  ];
  for (const [key, kind, status] of checks) {
    const value = receipts[key].value;
    if (value.kind !== kind || value.environment !== expected.environment) {
      throw new Error(`${key} receipt kind/environment mismatch.`);
    }
    if (status !== "createdAt" && value.status !== status) {
      throw new Error(`${key} receipt status mismatch.`);
    }
    if (value.project && value.project !== expected.project) {
      throw new Error(`${key} receipt project mismatch.`);
    }
  }
  for (const key of ["imageManifest", "migration", "deployment", "runtimeAudit", "databasePreflight", "databasePostflight"]) {
    if (receipts[key].value.gitSha !== expected.gitSha) {
      throw new Error(`${key} receipt gitSha mismatch.`);
    }
  }
}

export async function findBackupManifest(directory, environment, gitSha, replicaDirectory) {
  if (!directory) throw new Error("BACKUP_OUTPUT_DIR is required to resolve backup evidence.");
  const resolvedDirectory = resolve(String(directory));
  const files = (await readdir(resolvedDirectory))
    .filter((file) => file.endsWith(".manifest.json"))
    .sort();
  if (files.length !== 1) {
    throw new Error(`Exactly one backup manifest is required; found ${files.length}.`);
  }
  const primaryPath = resolve(resolvedDirectory, files[0]);
  const source = await readFile(primaryPath, "utf8");
  const manifest = JSON.parse(source);
  if (manifest.environment !== environment || manifest.gitSha !== gitSha || manifest.encrypted !== true) {
    throw new Error("Backup manifest environment/gitSha/encryption contract mismatch.");
  }
  if (!/^[a-f0-9]{64}$/u.test(String(manifest.sha256 || "")) || !(manifest.bytes > 0)) {
    throw new Error("Backup manifest artifact checksum/size is invalid.");
  }
  const primaryArtifactPath = resolveArtifactPath(resolvedDirectory, manifest.artifact);
  const primaryArtifact = await streamArtifactEvidence(primaryArtifactPath);
  assertArtifactMatchesManifest(primaryArtifact, manifest, "Primary backup");
  const primaryManifestChecksum = createHash("sha256").update(source).digest("hex");
  let artifactDirectory = resolvedDirectory;
  let manifestPath = primaryPath;
  let replicaArtifact = null;
  let replicaManifestPath = null;
  if (environment === "production") {
    if (!replicaDirectory) throw new Error("Production backup replica directory is required.");
    artifactDirectory = resolve(replicaDirectory);
    manifestPath = resolve(artifactDirectory, files[0]);
    replicaManifestPath = manifestPath;
    const replicaSource = await readFile(manifestPath, "utf8");
    if (replicaSource !== source) throw new Error("Production backup replica manifest does not match the primary manifest.");
    replicaArtifact = await streamArtifactEvidence(resolveArtifactPath(artifactDirectory, manifest.artifact));
    assertArtifactMatchesManifest(replicaArtifact, manifest, "Replica backup");
    if (
      replicaArtifact.sha256 !== primaryArtifact.sha256
      || replicaArtifact.bytes !== primaryArtifact.bytes
    ) {
      throw new Error("Production backup replica artifact does not match the primary artifact.");
    }
  }
  return {
    directory: artifactDirectory,
    manifestPath,
    primaryDirectory: resolvedDirectory,
    primaryManifestPath: primaryPath,
    primaryManifestChecksum,
    primaryArtifactChecksum: primaryArtifact.sha256,
    primaryArtifactBytes: primaryArtifact.bytes,
    replicaDirectory: environment === "production" ? artifactDirectory : null,
    replicaManifestPath,
    replicaArtifactChecksum: replicaArtifact?.sha256 || null,
    replicaArtifactBytes: replicaArtifact?.bytes || null,
    replicaVerified: environment === "production" ? true : false,
    manifestChecksum: primaryManifestChecksum,
    artifact: manifest.artifact,
    artifactChecksum: primaryArtifact.sha256,
    encrypted: true
  };
}

export async function streamArtifactEvidence(path) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: hash.digest("hex"), bytes };
}

function assertArtifactMatchesManifest(actual, manifest, label) {
  if (actual.sha256 !== manifest.sha256) {
    throw new Error(`${label} artifact checksum does not match its manifest.`);
  }
  if (actual.bytes !== manifest.bytes) {
    throw new Error(`${label} artifact byte size does not match its manifest.`);
  }
}

function resolveArtifactPath(directory, artifact) {
  if (!artifact || artifact !== String(artifact).split(/[\\/]/u).at(-1)) {
    throw new Error("Backup manifest artifact name is invalid.");
  }
  return resolve(directory, artifact);
}

async function main() {
  const result = await resolveReleaseContract();
  process.stdout.write(`${JSON.stringify({
    ok: true,
    environment: result.contract.environment,
    gitSha: result.contract.gitSha,
    contractPath: result.receipt.path,
    checksum: result.receipt.checksum,
    serviceUrlsVerified: true
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: safeMessage(error) })}\n`);
    process.exitCode = 1;
  });
}

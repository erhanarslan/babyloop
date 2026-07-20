#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { runCommand, timestampForFile, verifyBackupArtifact, writeJsonAtomic } from "./postgres-ops-lib.mjs";
import {
  RELEASE_MANIFEST_SCHEMA_VERSION,
  isDigestPinnedImage,
  readReleaseManifest,
  sha256Text
} from "./release-ops-lib.mjs";

const environment = (process.env.RELEASE_ENVIRONMENT || "staging").toLowerCase();
const gitSha = process.env.RELEASE_GIT_SHA || await gitHead();
const migrationHead = process.env.RELEASE_MIGRATION_HEAD || await journalHead();
const outputDirectory = resolve(process.env.RELEASE_MANIFEST_DIR || ".release/manifests");
const images = {
  api: requiredEnv("RELEASE_API_IMAGE"),
  backoffice: requiredEnv("RELEASE_BACKOFFICE_IMAGE"),
  web: requiredEnv("RELEASE_WEB_IMAGE")
};

if (["staging", "production"].includes(environment)) {
  for (const [service, image] of Object.entries(images)) {
    if (!isDigestPinnedImage(image)) {
      fail(`${service} image must be immutable and pinned as registry/name@sha256:<64 hex>.`);
    }
  }
}
if (!/^[a-f0-9]{40}$/u.test(gitSha)) {
  fail("RELEASE_GIT_SHA must be a full 40-character Git SHA.");
}

const backupManifestPath = process.env.RELEASE_BACKUP_MANIFEST_PATH
  ? resolve(process.env.RELEASE_BACKUP_MANIFEST_PATH)
  : "";
let backup = null;
if (backupManifestPath) {
  const backupManifestPreview = JSON.parse(await readFile(backupManifestPath, "utf8"));
  const artifactPath = join(dirname(backupManifestPath), backupManifestPreview.artifact || "");
  const backupManifest = await verifyBackupArtifact({ artifactPath, manifestPath: backupManifestPath });
  backup = {
    artifact: backupManifest.artifact,
    createdAt: backupManifest.createdAt,
    manifestPath: backupManifestPath,
    sha256: backupManifest.sha256
  };
}
if (environment === "production" && !backup) {
  fail("Production release manifests require RELEASE_BACKUP_MANIFEST_PATH from a verified pre-deploy backup.");
}

const previousManifestPath = process.env.RELEASE_PREVIOUS_MANIFEST_PATH
  ? resolve(process.env.RELEASE_PREVIOUS_MANIFEST_PATH)
  : "";
if (environment === "production" && !previousManifestPath && process.env.RELEASE_FIRST_PRODUCTION !== "true") {
  fail("Production release requires RELEASE_PREVIOUS_MANIFEST_PATH or RELEASE_FIRST_PRODUCTION=true for the first release.");
}
if (previousManifestPath) {
  const previous = (await readReleaseManifest(previousManifestPath, { requireChecksum: true })).manifest;
  if (previous.environment !== environment) {
    fail("Previous release manifest environment does not match RELEASE_ENVIRONMENT.");
  }
  for (const [service, value] of Object.entries(previous.services)) {
    if (!isDigestPinnedImage(value.image)) {
      fail(`Previous ${service} image is not pinned by SHA-256 digest.`);
    }
  }
}

const createdAt = new Date().toISOString();
const releaseId = `${environment}-${timestampForFile(new Date(createdAt))}-${gitSha.slice(0, 12)}`;
const manifest = {
  schemaVersion: RELEASE_MANIFEST_SCHEMA_VERSION,
  backup,
  createdAt,
  database: {
    forwardCompatibleWithPrevious: process.env.RELEASE_DATABASE_FORWARD_COMPATIBLE === "true",
    migrationHead
  },
  environment,
  gitSha,
  previousManifestPath: previousManifestPath || null,
  releaseId,
  services: {
    api: { image: images.api },
    backoffice: { image: images.backoffice },
    web: { image: images.web }
  }
};

await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
const manifestPath = resolve(outputDirectory, `${releaseId}.json`);
await writeJsonAtomic(manifestPath, manifest);
const content = await readFile(manifestPath, "utf8");
const checksum = sha256Text(content);
await writeFile(`${manifestPath}.sha256`, `${checksum}  ${basename(manifestPath)}\n`, { mode: 0o600 });

process.stdout.write(`${JSON.stringify({ checksum, manifestPath, releaseId }, null, 2)}\n`);

async function gitHead() {
  const result = await runCommand("git", ["rev-parse", "HEAD"], { quiet: true });
  return result.stdout.trim();
}

async function journalHead() {
  const journal = JSON.parse(await readFile("packages/database/drizzle/meta/_journal.json", "utf8"));
  return journal.entries?.at(-1)?.tag || "unknown";
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(`${name} is required.`);
  }
  return value;
}

function fail(message) {
  process.stderr.write(`Release manifest refused: ${message}\n`);
  process.exit(1);
}

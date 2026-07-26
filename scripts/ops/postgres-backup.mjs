#!/usr/bin/env node
import { chmod, mkdir, rename, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  BACKUP_MANIFEST_SCHEMA_VERSION,
  assertPgDumpCompatibility,
  collectDatabaseFingerprint,
  copyAtomic,
  createPgEnvironment,
  enforceBackupRetention,
  runCommand,
  safeDatabaseLabel,
  sanitizeFileSegment,
  sha256File,
  timestampForFile,
  writeJsonAtomic
} from "./postgres-ops-lib.mjs";

const databaseUrl = process.env.DATABASE_URL;
const environment = sanitizeFileSegment(process.env.BACKUP_ENVIRONMENT || "local").toLowerCase();
const outputDirectory = resolve(process.env.BACKUP_OUTPUT_DIR || "var/backups/postgres");
const replicaDirectory = process.env.BACKUP_REPLICA_DIR ? resolve(process.env.BACKUP_REPLICA_DIR) : "";
const encryptionMode = (process.env.BACKUP_ENCRYPTION_MODE || "none").toLowerCase();
const retentionDays = parsePositiveInteger(process.env.BACKUP_RETENTION_DAYS, 14);
const retentionCount = parsePositiveInteger(process.env.BACKUP_RETENTION_COUNT, 7);

if (!databaseUrl) {
  fail("DATABASE_URL is required.");
}
if (!["none", "age"].includes(encryptionMode)) {
  fail("BACKUP_ENCRYPTION_MODE must be none or age.");
}
if (["staging", "production"].includes(environment) && encryptionMode !== "age") {
  fail(`${environment} backups require BACKUP_ENCRYPTION_MODE=age.`);
}
if (environment === "production") {
  if (!replicaDirectory) {
    fail("Production backups require BACKUP_REPLICA_DIR on a separate persistent volume or mounted backup sink.");
  }
}
if (replicaDirectory && replicaDirectory === outputDirectory) {
  fail("BACKUP_REPLICA_DIR must differ from BACKUP_OUTPUT_DIR.");
}

const recipient = process.env.BACKUP_AGE_RECIPIENT || "";
if (encryptionMode === "age" && !recipient) {
  fail("BACKUP_AGE_RECIPIENT is required when BACKUP_ENCRYPTION_MODE=age.");
}

await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
await chmod(outputDirectory, 0o700);
const parsed = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
const timestamp = timestampForFile();
const baseName = `babyloop-${environment}-${sanitizeFileSegment(databaseName)}-${timestamp}`;
const rawTemporaryPath = join(outputDirectory, `.${baseName}.${process.pid}.dump.tmp`);
const plainArtifactPath = join(outputDirectory, `${baseName}.dump`);
const finalArtifactPath = encryptionMode === "age" ? `${plainArtifactPath}.age` : plainArtifactPath;
const encryptedTemporaryPath = `${finalArtifactPath}.${process.pid}.tmp`;
const manifestPath = `${finalArtifactPath}.manifest.json`;

try {
  const compatibility = await assertPgDumpCompatibility(databaseUrl);
  const fingerprint = await collectDatabaseFingerprint(databaseUrl);

  await runCommand(
    "pg_dump",
    ["--format=custom", "--compress=9", "--no-owner", "--no-privileges", "--file", rawTemporaryPath],
    { env: createPgEnvironment(databaseUrl), quiet: true }
  );
  await chmod(rawTemporaryPath, 0o600);

  if (encryptionMode === "age") {
    await runCommand(
      "age",
      ["--recipient", recipient, "--output", encryptedTemporaryPath, rawTemporaryPath],
      { quiet: true }
    );
    await chmod(encryptedTemporaryPath, 0o600);
    await rename(encryptedTemporaryPath, finalArtifactPath);
    await rm(rawTemporaryPath, { force: true });
  } else {
    await rename(rawTemporaryPath, finalArtifactPath);
  }

  const artifactStat = await stat(finalArtifactPath);
  const checksum = await sha256File(finalArtifactPath);
  const gitSha = await resolveGitSha();
  const migrationHead = await resolveMigrationHead();
  const manifest = {
    schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
    artifact: finalArtifactPath.split("/").pop(),
    bytes: artifactStat.size,
    createdAt: new Date().toISOString(),
    databaseName,
    encrypted: encryptionMode === "age",
    encryptionMode,
    environment,
    fingerprint,
    gitSha,
    migrationHead,
    pgDumpVersion: compatibility.clientVersion,
    retention: { count: retentionCount, days: retentionDays },
    sha256: checksum
  };

  await writeJsonAtomic(manifestPath, manifest);

  let replicaDeleted = 0;
  if (replicaDirectory) {
    await mkdir(replicaDirectory, { recursive: true, mode: 0o700 });
    const replicaArtifactPath = join(replicaDirectory, manifest.artifact);
    const replicaManifestPath = `${replicaArtifactPath}.manifest.json`;
    await copyAtomic(finalArtifactPath, replicaArtifactPath);
    await copyAtomic(manifestPath, replicaManifestPath);
    const replicaChecksum = await sha256File(replicaArtifactPath);
    if (replicaChecksum !== checksum) {
      fail("Replica backup checksum verification failed.");
    }
    replicaDeleted = await enforceBackupRetention({
      databaseName,
      directory: replicaDirectory,
      environment,
      retentionCount,
      retentionDays
    });
  }

  const deleted = await enforceBackupRetention({
    databaseName,
    directory: outputDirectory,
    environment,
    retentionCount,
    retentionDays
  });

  process.stdout.write(`${JSON.stringify({
    artifactPath: finalArtifactPath,
    database: safeDatabaseLabel(databaseUrl),
    deletedByRetention: deleted,
    encrypted: manifest.encrypted,
    manifestPath,
    replicaDeletedByRetention: replicaDeleted,
    replicaWritten: Boolean(replicaDirectory),
    sha256: checksum
  }, null, 2)}\n`);
} catch (error) {
  await Promise.all([
    rm(rawTemporaryPath, { force: true }),
    rm(encryptedTemporaryPath, { force: true })
  ]);
  fail(error instanceof Error ? error.message : "Database backup failed.");
}

function parsePositiveInteger(value, fallback) {
  const parsedValue = Number(value ?? fallback);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    fail("Backup retention values must be positive integers.");
  }
  return parsedValue;
}

async function resolveGitSha() {
  if (process.env.RELEASE_SOURCE_GIT_SHA || process.env.RELEASE_GIT_SHA) {
    return process.env.RELEASE_SOURCE_GIT_SHA || process.env.RELEASE_GIT_SHA;
  }
  try {
    const result = await runCommand("git", ["rev-parse", "HEAD"], { quiet: true });
    return result.stdout.trim();
  } catch {
    return "unknown";
  }
}

async function resolveMigrationHead() {
  try {
    const journal = JSON.parse(await (await import("node:fs/promises")).readFile("packages/database/drizzle/meta/_journal.json", "utf8"));
    return journal.entries?.at(-1)?.tag || "unknown";
  } catch {
    return "unknown";
  }
}

function fail(message) {
  process.stderr.write(`Database backup refused: ${message}\n`);
  process.exit(1);
}

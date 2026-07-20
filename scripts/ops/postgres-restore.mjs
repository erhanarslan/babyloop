#!/usr/bin/env node
import { chmod, mkdir, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import {
  collectDatabaseFingerprint,
  createPgEnvironment,
  queryScalar,
  runCommand,
  safeDatabaseLabel,
  verifyBackupArtifact,
  writeJsonAtomic
} from "./postgres-ops-lib.mjs";

const artifactPath = resolve(requiredEnv("RESTORE_ARTIFACT_PATH"));
const manifestPath = resolve(process.env.RESTORE_MANIFEST_PATH || `${artifactPath}.manifest.json`);
const databaseUrl = requiredEnv("RESTORE_DATABASE_URL");
const environment = (process.env.RESTORE_ENVIRONMENT || "local").toLowerCase();
const allowReplace = process.env.RESTORE_ALLOW_REPLACE === "true";
const confirmation = process.env.RESTORE_CONFIRM;
const productionConfirmation = process.env.RESTORE_PRODUCTION_CONFIRM;

if (confirmation !== "RESTORE_DATABASE") {
  fail("RESTORE_CONFIRM=RESTORE_DATABASE is required.");
}
if (environment === "production" && productionConfirmation !== "RESTORE_PRODUCTION_DATABASE") {
  fail("Production restore requires RESTORE_PRODUCTION_CONFIRM=RESTORE_PRODUCTION_DATABASE.");
}

const manifest = await verifyBackupArtifact({ artifactPath, manifestPath }).catch((error) => fail(error.message));
const targetDatabaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//u, ""));
if (/^(postgres|template0|template1)$/u.test(targetDatabaseName)) {
  fail(`Restore target ${targetDatabaseName} is a protected PostgreSQL system database.`);
}

const userTableCount = Number(await queryScalar(
  databaseUrl,
  "select count(*) from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema') and table_type = 'BASE TABLE';"
).catch((error) => fail(error.message)));

if (userTableCount > 0 && !allowReplace) {
  fail("Restore target is not empty. Set RESTORE_ALLOW_REPLACE=true only after an approved destructive restore decision.");
}
if (allowReplace && process.env.RESTORE_REPLACE_CONFIRM !== targetDatabaseName) {
  fail(`Destructive restore requires RESTORE_REPLACE_CONFIRM=${targetDatabaseName}.`);
}

const temporaryDirectory = resolve(process.env.RESTORE_TEMP_DIR || "var/restore-work");
await mkdir(temporaryDirectory, { recursive: true, mode: 0o700 });
await chmod(temporaryDirectory, 0o700);
const decryptedPath = resolve(temporaryDirectory, `restore-${process.pid}-${Date.now()}.dump`);
let restoreInputPath = artifactPath;

try {
  if (manifest.encrypted) {
    const identityFile = requiredEnv("BACKUP_AGE_IDENTITY_FILE");
    await runCommand("age", ["--decrypt", "--identity", identityFile, "--output", decryptedPath, artifactPath], { quiet: true });
    await chmod(decryptedPath, 0o600);
    restoreInputPath = decryptedPath;
  }

  await runCommand("pg_restore", ["--list", restoreInputPath], { quiet: true });
  const args = ["--exit-on-error", "--no-owner", "--no-privileges"];
  if (allowReplace) {
    args.push("--clean", "--if-exists");
  }
  args.push("--dbname", targetDatabaseName, restoreInputPath);
  await runCommand("pg_restore", args, { env: createPgEnvironment(databaseUrl), quiet: true });

  const restoredFingerprint = await collectDatabaseFingerprint(databaseUrl);
  assertFingerprint(manifest.fingerprint, restoredFingerprint);

  const receiptDirectory = resolve(process.env.RESTORE_RECEIPT_DIR || "var/restore-receipts");
  const receiptPath = resolve(receiptDirectory, `${basename(artifactPath)}.${Date.now()}.restore.json`);
  await writeJsonAtomic(receiptPath, {
    artifact: manifest.artifact,
    completedAt: new Date().toISOString(),
    database: safeDatabaseLabel(databaseUrl),
    destructiveReplace: allowReplace,
    environment,
    fingerprint: restoredFingerprint,
    manifestSha256: manifest.sha256,
    receiptVersion: 1
  });

  process.stdout.write(`${JSON.stringify({
    database: safeDatabaseLabel(databaseUrl),
    fingerprint: restoredFingerprint,
    receiptPath,
    restored: true
  }, null, 2)}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : "Database restore failed.");
} finally {
  await rm(decryptedPath, { force: true });
}

function assertFingerprint(expected, actual) {
  for (const key of ["migrationCount", "publicColumnCount", "publicTableCount"]) {
    if (Number(expected[key]) !== Number(actual[key])) {
      throw new Error(`Post-restore fingerprint mismatch for ${key}: expected ${expected[key]}, received ${actual[key]}.`);
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(`${name} is required.`);
  }
  return value;
}

function fail(message) {
  process.stderr.write(`Database restore refused: ${message}\n`);
  process.exit(1);
}

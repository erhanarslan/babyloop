#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPgEnvironment,
  deriveDatabaseUrl,
  parsePostgresUrl,
  runCommand,
  sanitizeFileSegment
} from "./postgres-ops-lib.mjs";

const sourceUrl = process.env.TEST_DATABASE_URL;
if (!sourceUrl) {
  fail("TEST_DATABASE_URL is required for the isolated restore smoke.");
}

const source = parsePostgresUrl(sourceUrl, "TEST_DATABASE_URL");
if (/production|prod/iu.test(source.databaseName)) {
  fail("Restore smoke refuses a source database whose name looks like production.");
}

const nonce = `${Date.now()}_${process.pid}`;
const targetDatabaseName = sanitizeFileSegment(`babyloop_restore_smoke_${nonce}`).replace(/-/gu, "_").toLowerCase();
const adminDatabaseName = process.env.RESTORE_SMOKE_ADMIN_DATABASE || "postgres";
const adminUrl = deriveDatabaseUrl(sourceUrl, adminDatabaseName);
const targetUrl = deriveDatabaseUrl(sourceUrl, targetDatabaseName);
const workDirectory = await mkdtemp(join(tmpdir(), "babyloop-restore-smoke-"));
let created = false;

try {
  await runCommand("createdb", [targetDatabaseName], { env: createPgEnvironment(adminUrl), quiet: true });
  created = true;

  const backup = await runCommand(process.execPath, ["scripts/ops/postgres-backup.mjs"], {
    env: {
      ...process.env,
      BACKUP_ENCRYPTION_MODE: "none",
      BACKUP_ENVIRONMENT: "test",
      BACKUP_OUTPUT_DIR: workDirectory,
      BACKUP_RETENTION_COUNT: "2",
      BACKUP_RETENTION_DAYS: "1",
      DATABASE_URL: sourceUrl
    },
    quiet: true
  });
  const backupResult = JSON.parse(backup.stdout);

  await runCommand(process.execPath, ["scripts/ops/postgres-restore.mjs"], {
    env: {
      ...process.env,
      RESTORE_ARTIFACT_PATH: backupResult.artifactPath,
      RESTORE_CONFIRM: "RESTORE_DATABASE",
      RESTORE_DATABASE_URL: targetUrl,
      RESTORE_ENVIRONMENT: "test",
      RESTORE_MANIFEST_PATH: backupResult.manifestPath,
      RESTORE_RECEIPT_DIR: workDirectory,
      RESTORE_TEMP_DIR: workDirectory
    },
    quiet: true
  });

  await runCommand("psql", ["--no-psqlrc", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--command", "select 1;"], {
    env: createPgEnvironment(targetUrl),
    quiet: true
  });

  process.stdout.write(`${JSON.stringify({
    backupChecksum: backupResult.sha256,
    sourceDatabase: source.databaseName,
    status: "passed",
    targetDatabase: targetDatabaseName
  }, null, 2)}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : "Restore smoke failed.");
} finally {
  if (created) {
    await runCommand("dropdb", ["--if-exists", "--force", targetDatabaseName], {
      env: createPgEnvironment(adminUrl),
      quiet: true
    }).catch(() => undefined);
  }
  await rm(workDirectory, { force: true, recursive: true });
}

function fail(message) {
  process.stderr.write(`Restore smoke failed: ${message}\n`);
  process.exitCode = 1;
}

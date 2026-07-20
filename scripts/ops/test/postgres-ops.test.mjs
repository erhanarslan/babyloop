import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertBackupManifest,
  deriveDatabaseUrl,
  parsePostgresClientMajor,
  parsePostgresUrl,
  selectRetentionDeletions,
  sha256File,
  verifyBackupArtifact,
  writeJsonAtomic
} from "../postgres-ops-lib.mjs";

test("parses PostgreSQL URLs without exposing credentials", () => {
  const parsed = parsePostgresUrl("postgresql://baby:secret@example.com:5433/babyloop?sslmode=require");
  assert.equal(parsed.databaseName, "babyloop");
  assert.equal(parsed.host, "example.com");
  assert.equal(parsed.port, "5433");
  assert.equal(parsed.sslMode, "require");
  assert.equal(deriveDatabaseUrl("postgresql://baby:secret@example.com/babyloop", "restore_db").includes("restore_db"), true);
});

test("selects retention deletions without deleting the newest protected sets", () => {
  const day = 24 * 60 * 60 * 1000;
  const nowMs = Date.parse("2026-07-20T12:00:00.000Z");
  const entries = [0, 1, 2, 20].map((daysAgo) => ({
    createdAtMs: nowMs - daysAgo * day,
    manifestPath: `backup-${daysAgo}.manifest.json`
  }));
  const deletions = selectRetentionDeletions(entries, {
    nowMs,
    retentionCount: 2,
    retentionDays: 7
  });
  assert.deepEqual(deletions.map((entry) => entry.manifestPath), ["backup-20.manifest.json"]);
});

test("verifies artifact checksum and manifest size", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-backup-test-"));
  try {
    const artifactPath = join(directory, "sample.dump");
    const manifestPath = `${artifactPath}.manifest.json`;
    await writeFile(artifactPath, "backup-bytes", { mode: 0o600 });
    const checksum = await sha256File(artifactPath);
    await writeJsonAtomic(manifestPath, {
      schemaVersion: 1,
      artifact: "sample.dump",
      bytes: 12,
      createdAt: "2026-07-20T12:00:00.000Z",
      databaseName: "babyloop_test",
      encrypted: false,
      encryptionMode: "none",
      environment: "test",
      fingerprint: {
        migrationCount: 43,
        publicColumnCount: 100,
        publicTableCount: 20,
        serverVersionNum: 160000
      },
      sha256: checksum
    });
    const manifest = await verifyBackupArtifact({ artifactPath, manifestPath });
    assert.equal(manifest.sha256, checksum);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("rejects malformed manifests and parses PostgreSQL client versions", () => {
  assert.throws(() => assertBackupManifest({ schemaVersion: 1 }), /missing artifact/u);
  assert.equal(parsePostgresClientMajor("pg_dump (PostgreSQL) 16.4"), 16);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  MIGRATION_EVIDENCE_POLL_ATTEMPTS,
  MIGRATION_EVIDENCE_POLL_DELAY_MS,
  pollForMigrationEvidence,
  readExecutionName,
  readExpectedMigrationHead,
  verifyMigrationEvidence,
} from "../migration-head-lib.mjs";

test("derives the migration tag and hash from the repository journal", async () => {
  const expected = await readExpectedMigrationHead();
  assert.equal(expected.expectedMigrationTag, "0045_production_demo_marketplace");
  assert.match(expected.expectedMigrationHash, /^[a-f0-9]{64}$/u);
});

test("accepts only exact execution-scoped migration verification evidence", () => {
  const expected = { expectedMigrationTag: "0045", expectedMigrationHash: "abc" };
  const result = verifyMigrationEvidence([{
    labels: { "run.googleapis.com/execution_name": "migration-123" },
    jsonPayload: {
      event: "migration_head_verified",
      ok: true,
      expectedMigrationTag: "0045",
      expectedMigrationHash: "abc",
      actualMigrationHash: "abc",
      verifiedTables: ["legal_acceptances"],
      verifiedAt: "2026-07-30T00:00:00.000Z",
    },
  }], expected, "migration-123");
  assert.equal(result.actualMigrationHash, "abc");
});

test("rejects false-success evidence with a stale database head", () => {
  assert.throws(() => verifyMigrationEvidence([{
    labels: { "run.googleapis.com/execution_name": "migration-123" },
    jsonPayload: {
      event: "migration_head_verified",
      ok: true,
      expectedMigrationTag: "0045",
      expectedMigrationHash: "abc",
      actualMigrationHash: "stale",
      verifiedTables: ["legal_acceptances"],
    },
  }], { expectedMigrationTag: "0045", expectedMigrationHash: "abc" }, "migration-123"));
});

test("extracts a short Cloud Run execution name", () => {
  assert.equal(readExecutionName({ metadata: { name: "projects/p/locations/r/executions/migration-123" } }), "migration-123");
});

test("uses a bounded default polling window of at least sixty seconds", () => {
  assert.ok(
    (MIGRATION_EVIDENCE_POLL_ATTEMPTS - 1) * MIGRATION_EVIDENCE_POLL_DELAY_MS >= 60_000,
  );
});

test("polls eventual evidence with injected sleep and no real delay", async () => {
  const delays = [];
  let reads = 0;
  const expected = { expectedMigrationTag: "0045", expectedMigrationHash: "abc" };
  const evidence = {
    labels: { "run.googleapis.com/execution_name": "migration-123" },
    jsonPayload: {
      event: "migration_head_verified",
      ok: true,
      expectedMigrationTag: "0045",
      expectedMigrationHash: "abc",
      actualMigrationHash: "abc",
      verifiedTables: ["legal_acceptances"],
    },
  };

  const result = await pollForMigrationEvidence({
    attempts: 3,
    delayMs: 5_000,
    executionName: "migration-123",
    expected,
    readEntries: async () => {
      reads += 1;
      return reads === 3 ? [evidence] : [];
    },
    sleep: async (delayMs) => {
      delays.push(delayMs);
    },
  });

  assert.equal(result.actualMigrationHash, "abc");
  assert.equal(reads, 3);
  assert.deepEqual(delays, [5_000, 5_000]);
});

test("does not retry logging read failures", async () => {
  let reads = 0;
  let sleeps = 0;

  await assert.rejects(() => pollForMigrationEvidence({
    executionName: "migration-123",
    expected: { expectedMigrationTag: "0045", expectedMigrationHash: "abc" },
    readEntries: async () => {
      reads += 1;
      throw new Error("PERMISSION_DENIED");
    },
    sleep: async () => {
      sleeps += 1;
    },
  }), /PERMISSION_DENIED/u);

  assert.equal(reads, 1);
  assert.equal(sleeps, 0);
});

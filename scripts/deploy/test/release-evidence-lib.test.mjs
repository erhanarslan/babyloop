import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeJsonReceipt } from "../deployment-lib.mjs";
import {
  MOBILE_RELEASE_CHECKS,
  PROVIDER_RELEASE_CHECKS,
  RELEASE_EVIDENCE_SCHEMA_VERSION,
  assertEvidence,
  assertFreshEvidence,
  percentile,
  readChecksummedEvidence,
  summarizeSamples
} from "../release-evidence-lib.mjs";

const gitSha = "a".repeat(40);

test("calculates deterministic percentile and sample summaries", () => {
  assert.equal(percentile([10, 30, 20, 40], 0.5), 20);
  assert.equal(percentile([10, 30, 20, 40], 0.95), 40);
  assert.deepEqual(summarizeSamples([
    { durationMs: 10, bytes: 100, status: 200 },
    { durationMs: 25, bytes: 250, status: 200 },
    { durationMs: 15, bytes: 150, status: 200 }
  ]), {
    count: 3,
    p50Ms: 15,
    p95Ms: 25,
    maxMs: 25,
    maxBytes: 250,
    statuses: [200]
  });
});

test("reads checksum-protected deployment acceptance evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-release-evidence-"));
  try {
    const path = join(directory, "acceptance.json");
    await writeJsonReceipt(path, deploymentAcceptance());
    const result = await readChecksummedEvidence(path, {
      kind: "deployment_acceptance",
      gitSha,
      maxAgeHours: 1
    });
    assert.equal(result.evidence.status, "passed");
    assert.match(result.sha256, /^[a-f0-9]{64}$/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects stale evidence and incomplete manual checklists", () => {
  const stale = deploymentAcceptance({ createdAt: "2024-01-01T00:00:00.000Z" });
  assert.throws(() => assertFreshEvidence(stale, { maxAgeHours: 1, nowMs: Date.parse("2024-01-02T00:00:00.000Z") }), /older than/u);

  assert.throws(() => assertEvidence({
    schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
    kind: "mobile_release_evidence",
    createdAt: new Date().toISOString(),
    gitSha,
    device: "Samsung Galaxy S22",
    osVersion: "Android",
    buildId: "build",
    tester: "tester",
    checks: Object.fromEntries(MOBILE_RELEASE_CHECKS.map((name) => [name, name !== "mfaOtp"]))
  }), /mfaOtp/u);
});

test("accepts complete mobile and provider manual evidence", () => {
  assert.equal(assertEvidence({
    schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
    kind: "mobile_release_evidence",
    createdAt: new Date().toISOString(),
    gitSha,
    device: "Samsung Galaxy S22",
    osVersion: "Android 15",
    buildId: "eas-build",
    tester: "Erhan",
    checks: Object.fromEntries(MOBILE_RELEASE_CHECKS.map((name) => [name, true]))
  }).kind, "mobile_release_evidence");

  assert.equal(assertEvidence({
    schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
    kind: "provider_release_evidence",
    createdAt: new Date().toISOString(),
    gitSha,
    environment: "staging",
    checks: Object.fromEntries(PROVIDER_RELEASE_CHECKS.map((name) => [name, true]))
  }).kind, "provider_release_evidence");
});

function deploymentAcceptance(overrides = {}) {
  return {
    schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
    kind: "deployment_acceptance",
    status: "passed",
    createdAt: new Date().toISOString(),
    environment: "staging",
    gitSha,
    release: {
      manifestPath: "/tmp/release.json",
      releaseId: "staging-release",
      gitSha,
      migrationHead: "0044"
    },
    probes: {},
    ...overrides
  };
}

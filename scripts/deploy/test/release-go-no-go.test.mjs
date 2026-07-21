import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { writeJsonReceipt } from "../deployment-lib.mjs";
import {
  MOBILE_RELEASE_CHECKS,
  PROVIDER_RELEASE_CHECKS,
  RELEASE_EVIDENCE_SCHEMA_VERSION,
  readChecksummedEvidence
} from "../release-evidence-lib.mjs";

const gitSha = "b".repeat(40);

test("creates a checksum-protected production GO receipt from fresh matching evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-go-no-go-"));
  try {
    const paths = {
      acceptance: join(directory, "acceptance.json"),
      restore: join(directory, "restore.json"),
      mobile: join(directory, "mobile.json"),
      providers: join(directory, "providers.json"),
      output: join(directory, "go.json")
    };
    const createdAt = new Date().toISOString();
    await writeJsonReceipt(paths.acceptance, {
      schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
      kind: "deployment_acceptance",
      status: "passed",
      createdAt,
      environment: "staging",
      gitSha,
      release: { manifestPath: "/tmp/release.json", releaseId: "staging-release", gitSha, migrationHead: "0044" },
      probes: {}
    });
    await writeJsonReceipt(paths.restore, {
      schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
      kind: "restore_smoke",
      status: "passed",
      createdAt,
      gitSha,
      sourceDatabase: "babyloop_test",
      targetDatabase: "babyloop_restore_smoke",
      backupChecksum: "c".repeat(64),
      migrationHead: "0044"
    });
    await writeJsonReceipt(paths.mobile, {
      schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
      kind: "mobile_release_evidence",
      createdAt,
      gitSha,
      device: "Samsung Galaxy S22",
      osVersion: "Android 15",
      buildId: "build-1",
      tester: "Erhan",
      checks: Object.fromEntries(MOBILE_RELEASE_CHECKS.map((name) => [name, true]))
    });
    await writeJsonReceipt(paths.providers, {
      schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
      kind: "provider_release_evidence",
      createdAt,
      gitSha,
      environment: "staging",
      checks: Object.fromEntries(PROVIDER_RELEASE_CHECKS.map((name) => [name, true]))
    });

    const result = spawnSync(process.execPath, ["scripts/deploy/release-go-no-go.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        GO_NO_GO_GIT_SHA: gitSha,
        GO_NO_GO_STAGING_ACCEPTANCE_PATH: paths.acceptance,
        GO_NO_GO_RESTORE_SMOKE_PATH: paths.restore,
        GO_NO_GO_MOBILE_EVIDENCE_PATH: paths.mobile,
        GO_NO_GO_PROVIDER_EVIDENCE_PATH: paths.providers,
        GO_NO_GO_OUTPUT_PATH: paths.output
      }
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.decision, "GO");
    const verified = await readChecksummedEvidence(paths.output, { kind: "production_go_no_go", gitSha, maxAgeHours: 1 });
    assert.equal(verified.evidence.inputs.mobile.kind, "mobile_release_evidence");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

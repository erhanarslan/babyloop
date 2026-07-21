import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { writeJsonReceipt } from "../deployment-lib.mjs";
import { readChecksummedEvidence, RELEASE_EVIDENCE_SCHEMA_VERSION } from "../release-evidence-lib.mjs";

test("creates a checksum-bound staging bootstrap plan from matching runtime audit evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-staging-plan-"));
  try {
    const gitShaResult = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    assert.equal(gitShaResult.status, 0, gitShaResult.stderr);
    const gitSha = gitShaResult.stdout.trim();
    const runtimeEnvPath = join(directory, "staging.runtime.env");
    const auditPath = join(directory, "runtime-audit.json");
    const releaseEnvPath = join(directory, "staging.release.env");
    const imageManifestPath = join(directory, "image-manifest.json");
    const outputPath = join(directory, "bootstrap-plan.json");

    await writeFile(runtimeEnvPath, "DEPLOY_ENVIRONMENT=staging\n", "utf8");
    await writeJsonReceipt(auditPath, {
      schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
      kind: "runtime_env_audit",
      status: "passed",
      createdAt: new Date().toISOString(),
      gitSha,
      environment: "staging",
      contractSha256: "c".repeat(64),
      sourceEnvFile: basename(runtimeEnvPath),
      keyCount: 80,
      secretKeyCount: 12,
      configuredProviders: ["s3-r2", "redis"],
      publicOrigins: ["https://staging.babyloop.test"],
      warnings: []
    });

    await writeJsonReceipt(imageManifestPath, {
      schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
      kind: "container_image_manifest",
      status: "ready",
      createdAt: new Date().toISOString(),
      gitSha,
      environment: "staging",
      images: {
        api: `ghcr.io/babyloop/api@sha256:${"a".repeat(64)}`,
        web: `ghcr.io/babyloop/web@sha256:${"b".repeat(64)}`,
        backoffice: `ghcr.io/babyloop/backoffice@sha256:${"d".repeat(64)}`
      }
    });

    await writeFile(releaseEnvPath, [
      "DEPLOY_ENVIRONMENT=staging",
      `DEPLOY_GIT_SHA=${gitSha}`,
      `DEPLOY_ENV_FILE=${runtimeEnvPath}`,
      `RUNTIME_ENV_AUDIT_EVIDENCE_PATH=${auditPath}`,
      `STAGING_BOOTSTRAP_PLAN_PATH=${outputPath}`,
      `IMAGE_MANIFEST_PATH=${imageManifestPath}`,
      "WEB_DOMAIN=staging.babyloop.test",
      "API_DOMAIN=api.staging.babyloop.test",
      "BACKOFFICE_DOMAIN=admin.staging.babyloop.test",
      ""
    ].join("\n"), "utf8");

    const result = spawnSync(process.execPath, [
      "scripts/deploy/create-staging-bootstrap-plan.mjs",
      `--release-env=${releaseEnvPath}`,
      "--skip-docker=true"
    ], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, "ready");

    const verified = await readChecksummedEvidence(outputPath, {
      kind: "staging_bootstrap_plan",
      gitSha,
      maxAgeHours: 1
    });
    assert.equal(verified.evidence.images.api.includes("@sha256:"), true);
    assert.equal(verified.evidence.domains.backoffice, "admin.staging.babyloop.test");
    assert.match(verified.evidence.composeSha256, /^[a-f0-9]{64}$/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects mutable image tags and mismatched release SHA", async () => {
  const script = await readFile("scripts/deploy/create-staging-bootstrap-plan.mjs", "utf8");
  assert.match(script, /assertDigestImage/u);
  assert.match(script, /does not match current HEAD/u);
  assert.match(script, /runtime_env_audit/u);
});

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { readChecksummedEvidence } from "../release-evidence-lib.mjs";

test("assembles three matrix digests into a checksum-protected image manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-image-manifest-"));
  try {
    const gitSha = "a".repeat(40);
    const outputPath = join(directory, "manifest.json");
    for (const [target, digestChar] of [
      ["api", "1"],
      ["web", "2"],
      ["backoffice", "3"]
    ]) {
      await writeFile(join(directory, `${target}.json`), JSON.stringify({
        target,
        image: `ghcr.io/babyloop/babyloop-${target}`,
        digest: `sha256:${digestChar.repeat(64)}`,
        gitSha,
        environment: "staging"
      }), "utf8");
    }

    const result = spawnSync(process.execPath, [
      "scripts/deploy/assemble-image-manifest.mjs",
      `--input-dir=${directory}`,
      "--environment=staging",
      `--git-sha=${gitSha}`,
      `--output=${outputPath}`
    ], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);

    const evidence = await readChecksummedEvidence(outputPath, {
      kind: "container_image_manifest",
      gitSha,
      maxAgeHours: 1
    });
    assert.equal(evidence.evidence.environment, "staging");
    assert.match(evidence.evidence.images.api, /@sha256:1{64}$/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects missing or mutable image metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-image-manifest-"));
  try {
    const gitSha = "b".repeat(40);
    await writeFile(join(directory, "api.json"), JSON.stringify({
      target: "api",
      image: "ghcr.io/babyloop/api:latest",
      digest: "latest",
      gitSha,
      environment: "staging"
    }), "utf8");

    const result = spawnSync(process.execPath, [
      "scripts/deploy/assemble-image-manifest.mjs",
      `--input-dir=${directory}`,
      "--environment=staging",
      `--git-sha=${gitSha}`,
      `--output=${join(directory, "manifest.json")}`
    ], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    assert.notEqual(result.status, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

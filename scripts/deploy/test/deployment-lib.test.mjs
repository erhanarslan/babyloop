import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertDigestImage,
  assertEnvironment,
  loadEnvFile,
  mergedEnvironment
} from "../deployment-lib.mjs";

test("accepts only staging and production environments", () => {
  assert.equal(assertEnvironment("STAGING"), "staging");
  assert.equal(assertEnvironment("production"), "production");
  assert.throws(() => assertEnvironment("local"), /staging or production/u);
});

test("requires immutable sha256 image references", () => {
  const image = `ghcr.io/example/babyloop-api@sha256:${"a".repeat(64)}`;
  assert.equal(assertDigestImage(image, "API_IMAGE"), image);
  assert.throws(() => assertDigestImage("ghcr.io/example/api:latest", "API_IMAGE"), /pinned/u);
});

test("loads a bounded env file without shell evaluation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-deploy-env-"));
  try {
    const path = join(directory, "staging.env");
    await writeFile(path, "DEPLOY_ENVIRONMENT=staging\nQUOTED=\"safe value\"\n# ignored\n", "utf8");
    const loaded = await loadEnvFile(path);
    assert.equal(loaded.values.DEPLOY_ENVIRONMENT, "staging");
    assert.equal(loaded.values.QUOTED, "safe value");
    assert.equal(loaded.values.UNSET, undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});


test("rejects duplicate env keys instead of silently overriding them", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-deploy-env-"));
  try {
    const path = join(directory, "duplicate.env");
    await writeFile(path, "KEY=first\nKEY=second\n", "utf8");
    await assert.rejects(() => loadEnvFile(path), /Duplicate env key KEY/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("merges explicit deployment overrides after env-file values", () => {
  const merged = mergedEnvironment({ API_IMAGE: "file" }, { API_IMAGE: "override" });
  assert.equal(merged.API_IMAGE, "override");
});

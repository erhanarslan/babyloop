#!/usr/bin/env node
import { mkdir, realpath, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { runCommand, writeJsonAtomic } from "./postgres-ops-lib.mjs";
import { buildRollbackPlan, readReleaseManifest } from "./release-ops-lib.mjs";

const currentPath = resolve(requiredEnv("ROLLBACK_CURRENT_MANIFEST_PATH"));
const targetPath = resolve(requiredEnv("ROLLBACK_TARGET_MANIFEST_PATH"));
const execute = process.env.ROLLBACK_EXECUTE === "true";
const requireChecksum = process.env.ROLLBACK_REQUIRE_CHECKSUM !== "false";
const current = (await readReleaseManifest(currentPath, { requireChecksum })).manifest;
const target = (await readReleaseManifest(targetPath, { requireChecksum })).manifest;
const plan = buildRollbackPlan({
  allowForwardSchema: process.env.ROLLBACK_ALLOW_FORWARD_SCHEMA === "true",
  current,
  target
});
const outputDirectory = resolve(process.env.ROLLBACK_PLAN_DIR || ".release/rollback-plans");
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
const planPath = resolve(outputDirectory, `${plan.fromReleaseId}-to-${plan.toReleaseId}.json`);
await writeJsonAtomic(planPath, plan);

if (execute) {
  if (process.env.ROLLBACK_CONFIRM !== `ROLLBACK_TO_${target.releaseId}`) {
    fail(`Execution requires ROLLBACK_CONFIRM=ROLLBACK_TO_${target.releaseId}.`);
  }
  const adapterPath = resolve(requiredEnv("ROLLBACK_ADAPTER_PATH"));
  const allowedDirectory = await realpath(resolve("scripts/deploy/adapters")).catch(() => "");
  const resolvedAdapter = await realpath(adapterPath).catch(() => "");
  if (!allowedDirectory || !resolvedAdapter || relative(allowedDirectory, resolvedAdapter).startsWith("..")) {
    fail("ROLLBACK_ADAPTER_PATH must be a checked-in file under scripts/deploy/adapters.");
  }
  const adapterStat = await stat(resolvedAdapter);
  if (!adapterStat.isFile()) {
    fail("Rollback adapter must be a regular file.");
  }
  await runCommand(process.execPath, [resolvedAdapter, planPath], { quiet: false });
}

process.stdout.write(`${JSON.stringify({
  executed: execute,
  planPath,
  schemaAction: plan.database.action,
  targetReleaseId: target.releaseId
}, null, 2)}\n`);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(`${name} is required.`);
  }
  return value;
}

function fail(message) {
  process.stderr.write(`Release rollback refused: ${message}\n`);
  process.exit(1);
}

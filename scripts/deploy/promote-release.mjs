#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  assertDigestImage,
  assertEnvironment,
  loadEnvFile,
  mergedEnvironment,
  required,
  runCommand,
  timestampForFile,
  writeJsonReceipt
} from "./deployment-lib.mjs";

const envFile = required(process.env.DEPLOY_ENV_FILE, "DEPLOY_ENV_FILE");
const loaded = await loadEnvFile(envFile);
const environment = assertEnvironment(process.env.DEPLOY_ENVIRONMENT || loaded.values.DEPLOY_ENVIRONMENT);
const expectedConfirmation = `DEPLOY_${environment.toUpperCase()}`;
if (process.env.DEPLOY_CONFIRM !== expectedConfirmation) throw new Error(`DEPLOY_CONFIRM=${expectedConfirmation} is required.`);
if (environment === "production" && process.env.DEPLOY_GO_NO_GO !== "GO") throw new Error("Production promotion requires DEPLOY_GO_NO_GO=GO.");

const images = {
  api: assertDigestImage(required(process.env.API_IMAGE, "API_IMAGE"), "API_IMAGE"),
  backoffice: assertDigestImage(required(process.env.BACKOFFICE_IMAGE, "BACKOFFICE_IMAGE"), "BACKOFFICE_IMAGE"),
  web: assertDigestImage(required(process.env.WEB_IMAGE, "WEB_IMAGE"), "WEB_IMAGE")
};
const composeFile = resolve(process.env.DEPLOY_COMPOSE_FILE || "deploy/compose/docker-compose.runtime.yml");
const commandEnv = mergedEnvironment(loaded.values, {
  API_IMAGE: images.api,
  BACKOFFICE_IMAGE: images.backoffice,
  WEB_IMAGE: images.web,
  DEPLOY_ENV_FILE: loaded.path,
  DEPLOY_ENVIRONMENT: environment,
  MIGRATION_ENVIRONMENT: environment,
  MIGRATION_CONFIRM: `APPLY_${environment.toUpperCase()}`
});

await runCommand("docker", ["compose", "--env-file", loaded.path, "-f", composeFile, "config", "--quiet"], { env: commandEnv });

const backupResult = await runCommand(process.execPath, ["scripts/ops/postgres-backup.mjs"], { capture: true, env: commandEnv });
const backup = JSON.parse(backupResult.stdout);
const readinessEnv = {
  ...commandEnv,
  RELEASE_BACKUP_MANIFEST_PATH: backup.manifestPath
};
await runCommand(process.execPath, ["scripts/check-deployment-readiness.mjs", `--target=${environment}`], { env: readinessEnv });
const manifestEnv = {
  ...commandEnv,
  RELEASE_ENVIRONMENT: environment,
  RELEASE_API_IMAGE: images.api,
  RELEASE_BACKOFFICE_IMAGE: images.backoffice,
  RELEASE_WEB_IMAGE: images.web,
  RELEASE_BACKUP_MANIFEST_PATH: backup.manifestPath,
  RELEASE_PREVIOUS_MANIFEST_PATH: process.env.RELEASE_PREVIOUS_MANIFEST_PATH || "",
  RELEASE_FIRST_PRODUCTION: process.env.RELEASE_FIRST_PRODUCTION || "false"
};
const manifestResult = await runCommand(process.execPath, ["scripts/ops/release-manifest.mjs"], { capture: true, env: manifestEnv });
const releaseManifest = JSON.parse(manifestResult.stdout);

await runCommand("docker", ["compose", "--env-file", loaded.path, "-f", composeFile, "--profile", "release", "run", "--rm", "migrate"], { env: commandEnv });
await runCommand("docker", ["compose", "--env-file", loaded.path, "-f", composeFile, "up", "-d", "--remove-orphans", "api", "web", "backoffice", "notification-worker", "child-reminder-worker"], { env: commandEnv });
const smokeResult = await runCommand(process.execPath, ["scripts/deploy/post-deploy-smoke.mjs"], { capture: true, env: commandEnv });
const smoke = JSON.parse(smokeResult.stdout);

const receiptPath = resolve(process.env.DEPLOY_RECEIPT_PATH || `.release/deployments/${environment}-${timestampForFile()}.json`);
const receipt = await writeJsonReceipt(receiptPath, {
  schemaVersion: 1,
  backupManifestPath: backup.manifestPath,
  createdAt: new Date().toISOString(),
  environment,
  images,
  releaseManifestPath: releaseManifest.manifestPath,
  smoke,
  sourceEnvFile: basename(loaded.path)
});
process.stdout.write(`${JSON.stringify({ ok: true, environment, receiptPath: receipt.path, checksum: receipt.checksum, releaseManifestPath: releaseManifest.manifestPath }, null, 2)}\n`);

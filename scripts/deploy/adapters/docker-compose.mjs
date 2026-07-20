#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertDigestImage,
  assertEnvironment,
  loadEnvFile,
  mergedEnvironment,
  required,
  runCommand
} from "../deployment-lib.mjs";

const planPath = resolve(required(process.argv[2], "rollback plan path"));
const plan = JSON.parse(await readFile(planPath, "utf8"));
const envFile = required(process.env.ROLLBACK_DEPLOY_ENV_FILE || process.env.DEPLOY_ENV_FILE, "ROLLBACK_DEPLOY_ENV_FILE");
const loaded = await loadEnvFile(envFile);
const environment = assertEnvironment(plan.environment);
const composeFile = resolve(process.env.DEPLOY_COMPOSE_FILE || "deploy/compose/docker-compose.runtime.yml");
const commandEnv = mergedEnvironment(loaded.values, {
  API_IMAGE: assertDigestImage(plan.services?.api?.image, "rollback api image"),
  BACKOFFICE_IMAGE: assertDigestImage(plan.services?.backoffice?.image, "rollback backoffice image"),
  WEB_IMAGE: assertDigestImage(plan.services?.web?.image, "rollback web image"),
  DEPLOY_ENV_FILE: loaded.path,
  DEPLOY_ENVIRONMENT: environment
});

await runCommand("docker", ["compose", "--env-file", loaded.path, "-f", composeFile, "config", "--quiet"], { env: commandEnv });
await runCommand("docker", ["compose", "--env-file", loaded.path, "-f", composeFile, "up", "-d", "--remove-orphans", "api", "web", "backoffice", "notification-worker", "child-reminder-worker"], { env: commandEnv });
await runCommand(process.execPath, ["scripts/deploy/post-deploy-smoke.mjs"], { env: commandEnv });

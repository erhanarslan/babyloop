#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  assertDigestImage,
  assertEnvironment,
  loadEnvFile,
  mergedEnvironment,
  required,
  runCommand
} from "./deployment-lib.mjs";

export async function buildComposePlan({
  environment = process.env,
  envFile = "",
  run = runCommand
} = {}) {
  const requestedEnvFile = envFile || readArg("--env-file") || required(environment.DEPLOY_ENV_FILE, "DEPLOY_ENV_FILE");
  const loaded = await loadEnvFile(requestedEnvFile);
  const deploymentEnvironment = assertEnvironment(
    environment.DEPLOY_ENVIRONMENT || loaded.values.DEPLOY_ENVIRONMENT
  );
  const composeFile = resolve(
    environment.DEPLOY_COMPOSE_FILE || "deploy/compose/docker-compose.runtime.yml"
  );
  const gitSha = required(environment.DEPLOY_GIT_SHA, "DEPLOY_GIT_SHA");
  if (!/^[a-f0-9]{40}$/u.test(gitSha)) {
    throw new Error("DEPLOY_GIT_SHA must be a full lowercase 40-character Git SHA.");
  }

  const commandEnv = mergedEnvironment(loaded.values, {
    API_IMAGE: assertDigestImage(required(environment.API_IMAGE, "API_IMAGE"), "API_IMAGE"),
    BACKOFFICE_IMAGE: assertDigestImage(
      required(environment.BACKOFFICE_IMAGE, "BACKOFFICE_IMAGE"),
      "BACKOFFICE_IMAGE"
    ),
    WEB_IMAGE: assertDigestImage(required(environment.WEB_IMAGE, "WEB_IMAGE"), "WEB_IMAGE"),
    DEPLOY_ENV_FILE: loaded.path,
    DEPLOY_ENVIRONMENT: deploymentEnvironment,
    DEPLOY_GIT_SHA: gitSha,
    MIGRATION_CONFIRM: ""
  });

  const command = "docker";
  const args = ["compose", "--env-file", loaded.path, "-f", composeFile, "config", "--quiet"];

  if (run) {
    await run(command, args, { env: commandEnv });
  }

  return {
    args,
    command,
    composeFile,
    environment: deploymentEnvironment,
    envFile: loaded.path,
    gitSha
  };
}

function readArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const plan = await buildComposePlan();
  process.stdout.write(`${JSON.stringify({
    ok: true,
    environment: plan.environment,
    envFile: plan.envFile,
    composeFile: plan.composeFile,
    gitSha: plan.gitSha,
    mutation: false
  }, null, 2)}\n`);
}

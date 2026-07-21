#!/usr/bin/env node
import { resolve } from "node:path";
import {
  assertEnvironment,
  loadEnvFile,
  mergedEnvironment,
  required,
  runCommand
} from "./deployment-lib.mjs";

const envFile = resolve(readArg("--env-file") || required(process.env.DEPLOY_ENV_FILE, "DEPLOY_ENV_FILE"));
const loaded = await loadEnvFile(envFile);
const target = assertEnvironment(readArg("--target") || loaded.values.DEPLOY_ENVIRONMENT);
await runCommand(process.execPath, ["scripts/check-deployment-readiness.mjs", `--target=${target}`], {
  env: mergedEnvironment(loaded.values, {
    DEPLOY_ENV_FILE: loaded.path,
    DEPLOY_ENVIRONMENT: target
  })
});
process.stdout.write(`${JSON.stringify({ ok: true, target, sourceEnvFile: loaded.path }, null, 2)}\n`);

function readArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

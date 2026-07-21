#!/usr/bin/env node
import { resolve } from "node:path";
import {
  loadEnvFile,
  mergedEnvironment,
  required,
  runCommand
} from "./deployment-lib.mjs";
import { auditRuntimeEnv } from "./runtime-env-lib.mjs";
import { readChecksummedEvidence } from "./release-evidence-lib.mjs";

const releaseEnvPath = resolve(readArg("--release-env") || required(process.env.DEPLOY_RELEASE_ENV_FILE, "DEPLOY_RELEASE_ENV_FILE"));
const releaseEnv = await loadEnvFile(releaseEnvPath);
if (releaseEnv.values.DEPLOY_ENVIRONMENT !== "staging") throw new Error("Only staging execution is supported by this command.");
if (process.env.STAGING_DEPLOY_CONFIRM !== "DEPLOY_STAGING") {
  throw new Error("STAGING_DEPLOY_CONFIRM=DEPLOY_STAGING is required.");
}

const planPath = resolve(required(
  process.env.STAGING_BOOTSTRAP_PLAN_PATH || releaseEnv.values.STAGING_BOOTSTRAP_PLAN_PATH,
  "STAGING_BOOTSTRAP_PLAN_PATH"
));
const gitSha = await gitHead();
const plan = await readChecksummedEvidence(planPath, {
  kind: "staging_bootstrap_plan",
  gitSha,
  maxAgeHours: Number(releaseEnv.values.GO_NO_GO_MAX_AGE_HOURS || 72)
});
const runtimeEnvFile = resolve(required(releaseEnv.values.DEPLOY_ENV_FILE, "DEPLOY_ENV_FILE"));
await auditRuntimeEnv({ envFile: runtimeEnvFile, target: "staging" });

const commandEnv = mergedEnvironment(releaseEnv.values, {
  API_IMAGE: plan.evidence.images.api,
  WEB_IMAGE: plan.evidence.images.web,
  BACKOFFICE_IMAGE: plan.evidence.images.backoffice,
  DEPLOY_ENV_FILE: runtimeEnvFile,
  DEPLOY_ENVIRONMENT: "staging",
  DEPLOY_CONFIRM: "DEPLOY_STAGING",
  STAGING_BOOTSTRAP_PLAN_PATH: plan.path,
  RUNTIME_ENV_AUDIT_EVIDENCE_PATH: plan.evidence.runtimeEnvAudit.path
});
const composeFile = resolve(releaseEnv.values.DEPLOY_COMPOSE_FILE || "deploy/compose/docker-compose.runtime.yml");

await runCommand("docker", ["compose", "--env-file", releaseEnvPath, "-f", composeFile, "config", "--quiet"], { env: commandEnv });

if (process.env.STAGING_DEPLOY_DRY_RUN === "true") {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    dryRun: true,
    gitSha,
    planPath: plan.path,
    services: ["api", "web", "backoffice", "notification-worker", "child-reminder-worker"]
  }, null, 2)}\n`);
  process.exit(0);
}

await runCommand(process.execPath, ["scripts/deploy/promote-release.mjs"], { env: commandEnv });
process.stdout.write(`${JSON.stringify({ ok: true, environment: "staging", gitSha, planPath: plan.path }, null, 2)}\n`);

async function gitHead() {
  const result = await runCommand("git", ["rev-parse", "HEAD"], { capture: true });
  const value = result.stdout.trim();
  if (!/^[a-f0-9]{40}$/u.test(value)) throw new Error("git rev-parse HEAD did not return a full SHA.");
  return value;
}
function readArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

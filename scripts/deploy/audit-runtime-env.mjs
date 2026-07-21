#!/usr/bin/env node
import { resolve } from "node:path";
import { auditRuntimeEnv, publicAuditView } from "./runtime-env-lib.mjs";
import { required, runCommand, timestampForFile, writeJsonReceipt } from "./deployment-lib.mjs";

const envFile = resolve(readArg("--env-file") || required(process.env.DEPLOY_ENV_FILE, "DEPLOY_ENV_FILE"));
const target = readArg("--target") || process.env.DEPLOY_ENVIRONMENT;
const audit = await auditRuntimeEnv({
  envFile,
  target,
  allowExample: readArg("--allow-example") === "true",
  allowInsecurePermissions: process.env.RUNTIME_ENV_AUDIT_ALLOW_INSECURE_PERMISSIONS === "true"
});
const gitSha = process.env.DEPLOY_GIT_SHA || await gitHead();
const outputPath = resolve(
  readArg("--output")
  || process.env.RUNTIME_ENV_AUDIT_EVIDENCE_PATH
  || `.release/evidence/${audit.environment}-runtime-env-audit-${timestampForFile()}-${gitSha.slice(0, 12)}.json`
);
const receipt = await writeJsonReceipt(outputPath, publicAuditView(audit, gitSha));
process.stdout.write(`${JSON.stringify({
  ok: true,
  environment: audit.environment,
  outputPath: receipt.path,
  checksum: receipt.checksum,
  configuredProviders: audit.configuredProviders,
  warnings: audit.warnings
}, null, 2)}\n`);

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

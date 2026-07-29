#!/usr/bin/env node
import { resolve } from "node:path";
import { loadEnvFile } from "../deploy/deployment-lib.mjs";
import { auditRuntimeEnv, isSecretKey, loadRuntimeEnvContract } from "../deploy/runtime-env-lib.mjs";
import { verifyRuntimeIdentifierContinuity } from "../deploy/runtime-identifier-continuity.mjs";
import {
  artifactRoot,
  assertConfirmation,
  assertEnvironment,
  assertGcloudContext,
  gcloud,
  gcloudResourceExists,
  loadCloudRunContract,
  parseFlag,
  safeMessage,
  secretId,
  serviceAccountEmail,
  writeEnvYaml,
  writeJson
} from "./cloud-run-lib.mjs";

const EXCLUDED_RUNTIME_KEYS = new Set([
  "PORT", "DEPLOY_ACCEPTANCE_EVIDENCE_PATH", "RUNTIME_ENV_AUDIT_EVIDENCE_PATH",
  "STAGING_BOOTSTRAP_PLAN_PATH", "PROVIDER_PROBE_EVIDENCE_PATH", "BACKUP_OUTPUT_DIR",
  "BACKUP_REPLICA_DIR", "BACKUP_RESTORE_SMOKE_EVIDENCE", "PRODUCTION_GO_NO_GO_RECEIPT_PATH"
]);

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const envFile = parseFlag("env-file");
  if (!envFile) throw new Error("--env-file is required.");
  const { contract } = await loadCloudRunContract();
  assertConfirmation("secret-import", environment);
  const audit = await auditRuntimeEnv({ target: environment, envFile });
  const identifierContinuity = environment === "production"
    ? await verifyRuntimeIdentifierContinuity({ audit })
    : null;
  const context = await assertGcloudContext(contract, environment, { mutation: true });
  const [{ values }, runtimeContractResult] = await Promise.all([
    loadEnvFile(envFile),
    loadRuntimeEnvContract()
  ]);
  const secretBindings = {};
  const secretVersions = {};
  const nonSecrets = {};

  for (const [key, value] of Object.entries(values)) {
    if (!value || EXCLUDED_RUNTIME_KEYS.has(key)) continue;
    if (!isSecretKey(key, runtimeContractResult.contract)) {
      nonSecrets[key] = value;
      continue;
    }
    const id = secretId(contract, key);
    if (!(await gcloudResourceExists(
      ["secrets", "describe", id, `--project=${context.project}`],
      { resource: `Secret Manager secret ${id}` }
    ))) {
      await gcloud([
        "secrets", "create", id,
        "--replication-policy=automatic",
        `--project=${context.project}`,
        `--labels=application=babyloop,environment=${environment}`
      ]);
    }
    const versionResult = await gcloud([
      "secrets", "versions", "add", id,
      "--data-file=-",
      `--project=${context.project}`,
      "--format=value(name)"
    ], { capture: true, input: value });
    const versionName = versionResult.stdout.trim();
    const version = versionName.split("/").at(-1);
    if (!version || !/^\d+$/u.test(version)) throw new Error(`Could not determine Secret Manager version for ${key}.`);
    secretBindings[key] = `${id}:${version}`;
    secretVersions[key] = { secretId: id, version };
    for (const role of ["api", "jobs"]) {
      const member = serviceAccountEmail(contract, role, context.project);
      await gcloud([
        "secrets", "add-iam-policy-binding", id,
        `--member=serviceAccount:${member}`,
        "--role=roles/secretmanager.secretAccessor",
        "--condition=None",
        `--project=${context.project}`
      ]);
    }
  }

  nonSecrets.PORT = "8080";
  nonSecrets.API_HOST = "0.0.0.0";
  nonSecrets.NOTIFICATION_WORKER_MAX_STALENESS_SECONDS = String(Math.max(900, Number.parseInt(nonSecrets.NOTIFICATION_WORKER_MAX_STALENESS_SECONDS || "0", 10) || 0));
  nonSecrets.CHILD_REMINDER_WORKER_MAX_STALENESS_SECONDS = String(Math.max(900, Number.parseInt(nonSecrets.CHILD_REMINDER_WORKER_MAX_STALENESS_SECONDS || "0", 10) || 0));

  const root = artifactRoot(contract, environment);
  const envYaml = await writeEnvYaml(resolve(root, "api-runtime.env.yaml"), nonSecrets);
  const secretManifest = await writeJson(resolve(root, "secret-manifest.json"), {
    schemaVersion: 1,
    kind: "gcp_secret_manifest",
    createdAt: new Date().toISOString(),
    environment,
    project: context.project,
    sourceEnvFile: resolve(envFile),
    identifierContinuity,
    secretBindings,
    secretVersions,
    nonSecretEnvFile: envYaml
  });
  console.log(JSON.stringify({
    ok: true,
    environment,
    project: context.project,
    secretCount: Object.keys(secretBindings).length,
    nonSecretCount: Object.keys(nonSecrets).length,
    manifest: secretManifest.path,
    valuesPrinted: false
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
  process.exitCode = 1;
});

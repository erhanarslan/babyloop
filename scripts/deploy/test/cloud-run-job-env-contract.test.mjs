import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCloudRunEnvSources,
} from "../../gcp/deploy-cloud-run.mjs";

test("Cloud Run services and jobs exclude platform-reserved environment variables", () => {
  const { runtimeEnvSource, migrationEnvSource } = buildCloudRunEnvSources(
    [
      'NODE_ENV: "production"',
      'PORT: "4000"',
      'K_SERVICE: "forbidden-service"',
      'K_REVISION: "forbidden-revision"',
      'K_CONFIGURATION: "forbidden-configuration"',
      'CLOUD_RUN_JOB: "forbidden-job"',
      'CLOUD_RUN_EXECUTION: "forbidden-execution"',
      'CLOUD_RUN_TASK_INDEX: "0"',
      'CLOUD_RUN_TASK_ATTEMPT: "0"',
      'CLOUD_RUN_TASK_COUNT: "1"',
      'X_GOOGLE_INTERNAL: "forbidden"',
      'API_HOST: "0.0.0.0"',
      'PORTAL_URL: "https://example.test"',
      "",
    ].join("\n"),
    "staging",
  );

  assert.doesNotMatch(runtimeEnvSource, /^PORT\s*:/mu);
  for (const name of [
    "K_SERVICE",
    "K_REVISION",
    "K_CONFIGURATION",
    "CLOUD_RUN_JOB",
    "CLOUD_RUN_EXECUTION",
    "CLOUD_RUN_TASK_INDEX",
    "CLOUD_RUN_TASK_ATTEMPT",
    "CLOUD_RUN_TASK_COUNT",
    "X_GOOGLE_INTERNAL",
  ]) {
    assert.doesNotMatch(
      runtimeEnvSource,
      new RegExp(`^${name}\\s*:`, "mu"),
    );
  }
  assert.match(runtimeEnvSource, /^NODE_ENV\s*:/mu);
  assert.match(runtimeEnvSource, /^API_HOST\s*:/mu);
  assert.match(runtimeEnvSource, /^PORTAL_URL\s*:/mu);
  assert.doesNotMatch(runtimeEnvSource, /^MIGRATION_CONFIRM\s*:/mu);
  assert.match(migrationEnvSource, /^MIGRATION_CONFIRM: "APPLY_STAGING"$/mu);
});

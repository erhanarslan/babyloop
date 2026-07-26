import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  stripCloudRunJobReservedEnv,
} from "../../gcp/cloud-run-job-env-lib.mjs";

test("Cloud Run services and jobs exclude the reserved PORT environment variable", async () => {
  const output = stripCloudRunJobReservedEnv(
    [
      'NODE_ENV: "production"',
      'PORT: "4000"',
      'API_HOST: "0.0.0.0"',
      'PORTAL_URL: "https://example.test"',
      "",
    ].join("\n"),
  );

  assert.doesNotMatch(output, /^PORT\s*:/mu);
  assert.match(output, /^NODE_ENV\s*:/mu);
  assert.match(output, /^API_HOST\s*:/mu);
  assert.match(output, /^PORTAL_URL\s*:/mu);

  const deploySource = await readFile(
    "scripts/gcp/deploy-cloud-run.mjs",
    "utf8",
  );

  assert.match(
    deploySource,
    /job-runtime\.env\.yaml/u,
  );

  assert.match(
    deploySource,
    /stripCloudRunJobReservedEnv\s*\(\s*apiEnvSource\s*\)/u,
  );

  assert.match(
    deploySource,
    /key === "migrate" \? migrationEnvFile : jobEnvFile/u,
  );

  assert.match(
    deploySource,
    /urls\.api = await deployService\(\{[\s\S]{0,500}envFile: jobEnvFile[\s\S]{0,200}secrets: secretBindings/u,
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("Cloud Run contract uses separate least-privilege identities", async () => {
  const contract = JSON.parse(await readFile("deploy/gcp/cloud-run.contract.json", "utf8"));
  const identities = Object.values(contract.serviceAccounts);
  assert.equal(new Set(identities).size, identities.length);
  assert.ok(contract.requiredApis.includes("secretmanager.googleapis.com"));
  assert.ok(contract.requiredApis.includes("cloudscheduler.googleapis.com"));
  assert.equal(contract.services.api.timeout, "3600s");
  assert.equal(contract.services.web.memory, "512Mi");
  assert.equal(contract.jobs.migrate.maxRetries, 0);
  assert.equal(Object.hasOwn(contract.jobs.migrate, "schedule"), false);
});

test("deployment scripts never request service account keys or mutable images", async () => {
  const files = [
    "scripts/gcp/bootstrap-cloud-run.mjs",
    "scripts/gcp/import-runtime-env.mjs",
    "scripts/gcp/build-cloud-run-images.mjs",
    "scripts/gcp/deploy-cloud-run.mjs",
    "scripts/gcp/execute-cloud-run-migration.mjs"
  ];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /keys create|service-account-key|:latest/iu, file);
    assert.doesNotMatch(source, /shell\s*:\s*true/u, file);
  }
});

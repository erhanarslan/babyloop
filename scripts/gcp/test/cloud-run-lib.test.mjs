import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertConfirmation,
  assertDigestImage,
  assertEnvironment,
  confirmationValue,
  expectedProject,
  gcloudJsonResource,
  loadCloudRunContract,
  secretId,
  serviceAccountEmail,
  writeEnvYaml
} from "../cloud-run-lib.mjs";

test("contract isolates staging and production projects and caps initial scale", async () => {
  const { contract } = await loadCloudRunContract();
  assert.equal(expectedProject(contract, "staging"), "babyloop-staging");
  assert.equal(expectedProject(contract, "production"), "babyloop-production");
  assert.notEqual(contract.projects.staging, contract.projects.production);
  for (const service of Object.values(contract.services)) {
    assert.equal(service.minInstances, 0);
    assert.equal(service.maxInstances, 1);
  }
  assert.equal(contract.jobs.notification.schedule, "*/5 * * * *");
  assert.equal(contract.jobs.childReminder.schedule, "*/5 * * * *");
});

test("confirmation tokens are environment specific and fail closed", () => {
  assert.equal(confirmationValue("secret-import", "staging"), "SECRET_IMPORT_STAGING");
  assert.deepEqual(assertConfirmation("deploy", "staging", { GCP_DEPLOY_CONFIRM: "DEPLOY_STAGING" }), {
    name: "GCP_DEPLOY_CONFIRM",
    expected: "DEPLOY_STAGING"
  });
  assert.throws(() => assertConfirmation("deploy", "production", { GCP_DEPLOY_CONFIRM: "DEPLOY_STAGING" }), /DEPLOY_PRODUCTION/);
});

test("secret ids and service account identities are deterministic", async () => {
  const { contract } = await loadCloudRunContract();
  assert.equal(secretId(contract, "DATABASE_URL"), "babyloop-database-url");
  assert.equal(serviceAccountEmail(contract, "api", "babyloop-staging"), "babyloop-api-runtime@babyloop-staging.iam.gserviceaccount.com");
});

test("digest and environment validation reject mutable or ambiguous inputs", () => {
  assert.equal(assertEnvironment("STAGING"), "staging");
  assert.throws(() => assertEnvironment("dev"), /staging or production/);
  assert.match(assertDigestImage(`europe-west1-docker.pkg.dev/p/r/i@sha256:${"a".repeat(64)}`, "image"), /@sha256:/);
  assert.throws(() => assertDigestImage("image:latest", "image"), /pinned/);
});

test("env yaml writes quoted values without shell evaluation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-gcp-env-"));
  const path = join(directory, "runtime.yaml");
  await writeEnvYaml(path, { SAFE: "$(touch /tmp/never)", URL: "https://example.test" });
  const source = await readFile(path, "utf8");
  assert.match(source, /SAFE: "\$\(touch \/tmp\/never\)"/);
  assert.match(source, /URL: "https:\/\/example.test"/);
});

test("JSON resource lookup hides only NOT_FOUND and preserves operational failures", async () => {
  assert.equal(
    await gcloudJsonResource(
      ["scheduler", "jobs", "describe", "missing"],
      {
        execute: async () => {
          throw new Error("NOT_FOUND: Job not found");
        },
        resource: "Cloud Scheduler job missing"
      }
    ),
    null
  );
  await assert.rejects(
    gcloudJsonResource(
      ["scheduler", "jobs", "describe", "protected"],
      {
        execute: async () => {
          throw new Error("PERMISSION_DENIED: cloudscheduler.jobs.get");
        },
        resource: "Cloud Scheduler job protected"
      }
    ),
    /Cloud Scheduler job protected describe failed.*PERMISSION_DENIED/u
  );
  assert.deepEqual(
    await gcloudJsonResource(
      ["run", "jobs", "describe", "present"],
      {
        execute: async () => ({ stdout: '{"name":"present"}' }),
        resource: "Cloud Run job present"
      }
    ),
    { name: "present" }
  );
});

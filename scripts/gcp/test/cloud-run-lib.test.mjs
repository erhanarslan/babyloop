import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertConfirmation,
  assertDigestImage,
  assertEnvironment,
  assertGcloudContext,
  assertMutationTarget,
  confirmationValue,
  expectedProject,
  gcloudJsonResource,
  loadCloudRunContract,
  secretId,
  serviceAccountEmail,
  writeEnvYaml
} from "../cloud-run-lib.mjs";

test("contract maps logical production to the existing physical project and caps initial scale", async () => {
  const { contract } = await loadCloudRunContract();
  assert.equal(expectedProject(contract, "staging"), "babyloop-staging");
  assert.equal(expectedProject(contract, "production"), "babyloop-staging");
  assert.equal(contract.environments.staging.deployable, false);
  assert.equal(contract.environments.production.deployable, true);
  for (const service of Object.values(contract.services)) {
    assert.equal(service.minInstances, 0);
    assert.equal(service.maxInstances, 1);
  }
  assert.equal(contract.jobs.notification.schedule, "*/5 * * * *");
  assert.equal(contract.jobs.childReminder.schedule, "*/5 * * * *");
});

const cleanLocalMutation = {
  env: { DEPLOY_TOPOLOGY: "single_environment" },
  resolveLocalBranch: async () => "master",
  resolveWorktreeStatus: async () => ""
};

test("GCP mutation is fail-closed outside production on master and the approved project", async () => {
  const { contract } = await loadCloudRunContract();
  assert.deepEqual(await assertMutationTarget(contract, "production", cleanLocalMutation), {
    environment: "production",
    project: "babyloop-staging"
  });
  await assert.rejects(
    assertMutationTarget(contract, "staging", cleanLocalMutation),
    /logical environment production/u
  );
  await assert.rejects(
    assertMutationTarget(contract, "production", {
      ...cleanLocalMutation,
      env: {
        DEPLOY_TOPOLOGY: "single_environment",
        GITHUB_ACTIONS: "true",
        GITHUB_REF: "refs/heads/staging"
      }
    }),
    /refs\/heads\/master/u
  );
  const wrongProjectContract = structuredClone(contract);
  wrongProjectContract.projects.production = ["babyloop", "production"].join("-");
  wrongProjectContract.environments.production.projectId = wrongProjectContract.projects.production;
  await assert.rejects(
    assertMutationTarget(wrongProjectContract, "production", cleanLocalMutation),
    /approved single physical project/u
  );
});

test("mutation topology, branch, and clean-worktree gates cannot be bypassed", async () => {
  const { contract } = await loadCloudRunContract();
  for (const env of [{}, { DEPLOY_TOPOLOGY: "dual_environment" }]) {
    await assert.rejects(
      assertMutationTarget(contract, "production", { ...cleanLocalMutation, env }),
      /DEPLOY_TOPOLOGY must equal single_environment/u
    );
  }
  await assert.rejects(
    assertMutationTarget(contract, "production", {
      ...cleanLocalMutation,
      resolveLocalBranch: async () => "feature/cutover"
    }),
    /branch master/u
  );
  for (const status of [
    " M deploy/docker/Dockerfile",
    "M  deploy/docker/Dockerfile",
    "?? apps/api/untracked-runtime.ts"
  ]) {
    await assert.rejects(
      assertMutationTarget(contract, "production", {
        ...cleanLocalMutation,
        resolveWorktreeStatus: async () => status
      }),
      /clean worktree/u
    );
  }
});

test("mutation validates active gcloud project and region after source guards", async () => {
  const { contract } = await loadCloudRunContract();
  const executeFor = ({ project = "babyloop-staging", region = "europe-west1" } = {}) => async (args) => {
    const command = args.join(" ");
    if (command.startsWith("auth list")) return { stdout: "release@example.com\n" };
    if (command.startsWith("config get-value project")) return { stdout: `${project}\n` };
    if (command.startsWith("billing projects describe")) return { stdout: '{"billingEnabled":true}' };
    if (command.startsWith("config get-value run/region")) return { stdout: `${region}\n` };
    if (command.startsWith("projects describe")) return { stdout: "123456789\n" };
    throw new Error(`Unexpected command: ${command}`);
  };
  assert.equal((await assertGcloudContext(contract, "production", {
    ...cleanLocalMutation,
    mutation: true,
    execute: executeFor()
  })).project, "babyloop-staging");
  await assert.rejects(
    assertGcloudContext(contract, "production", {
      ...cleanLocalMutation,
      mutation: true,
      execute: executeFor({ project: "wrong-project" })
    }),
    /Active gcloud project must be babyloop-staging/u
  );
  await assert.rejects(
    assertGcloudContext(contract, "production", {
      ...cleanLocalMutation,
      mutation: true,
      execute: executeFor({ region: "us-central1" })
    }),
    /Active run\/region must be europe-west1/u
  );
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

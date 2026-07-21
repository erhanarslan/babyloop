import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { test } from "node:test";
import { buildComposePlan } from "../render-compose-plan.mjs";

const DIGEST = `sha256:${"a".repeat(64)}`;

test("renders a non-mutating compose plan with an absolute runtime env path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-compose-plan-"));
  const envFile = join(directory, "staging.runtime.env");
  await writeFile(envFile, "DEPLOY_ENVIRONMENT=staging\n", { mode: 0o600 });

  const calls = [];
  const plan = await buildComposePlan({
    envFile,
    environment: {
      API_IMAGE: `ghcr.io/example/api@${DIGEST}`,
      BACKOFFICE_IMAGE: `ghcr.io/example/backoffice@${DIGEST}`,
      DEPLOY_ENVIRONMENT: "staging",
      DEPLOY_GIT_SHA: "1".repeat(40),
      WEB_IMAGE: `ghcr.io/example/web@${DIGEST}`
    },
    run: async (command, args, options) => {
      calls.push({ args, command, env: options.env });
      return { code: 0, signal: null, stderr: "", stdout: "" };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "docker");
  assert.deepEqual(calls[0].args.slice(0, 3), ["compose", "--env-file", envFile]);
  assert.equal(calls[0].env.DEPLOY_ENV_FILE, envFile);
  assert.equal(calls[0].env.MIGRATION_CONFIRM, "");
  assert.equal(plan.envFile, envFile);
  assert.equal(isAbsolute(plan.envFile), true);
  assert.equal(plan.environment, "staging");
});

test("rejects mutable images and abbreviated Git revisions before invoking Docker", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-compose-plan-invalid-"));
  const envFile = join(directory, "staging.runtime.env");
  await writeFile(envFile, "DEPLOY_ENVIRONMENT=staging\n", { mode: 0o600 });

  let invoked = false;
  await assert.rejects(
    buildComposePlan({
      envFile,
      environment: {
        API_IMAGE: "ghcr.io/example/api:latest",
        BACKOFFICE_IMAGE: `ghcr.io/example/backoffice@${DIGEST}`,
        DEPLOY_ENVIRONMENT: "staging",
        DEPLOY_GIT_SHA: "abc123",
        WEB_IMAGE: `ghcr.io/example/web@${DIGEST}`
      },
      run: async () => {
        invoked = true
      }
    }),
    /DEPLOY_GIT_SHA must be a full lowercase 40-character Git SHA/
  );
  assert.equal(invoked, false);
});

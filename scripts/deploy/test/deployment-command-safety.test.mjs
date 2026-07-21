import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inspectJavaScriptSource,
  inspectShellSource,
  stripJavaScriptNonCode
} from "../../check-deployment-command-safety.mjs";

test("ignores shell: true and source text inside strings and comments", () => {
  const source = `
    const message = "shell: true";
    const error = "Runtime env audit source file does not match DEPLOY_ENV_FILE.";
    // shell: true
    /* source "$DEPLOY_ENV_FILE" */
    runCommand("docker", ["compose"], { env });
  `;

  assert.equal(stripJavaScriptNonCode(source).includes("shell: true"), false);
  assert.deepEqual(inspectJavaScriptSource(source, "safe.mjs"), []);
});

test("rejects an actual shell true child-process option", () => {
  const source = `
    spawn("docker", ["compose"], {
      env: process.env,
      shell: true
    });
  `;

  assert.deepEqual(inspectJavaScriptSource(source, "unsafe.mjs"), [
    "unsafe.mjs enables child-process shell execution with shell: true."
  ]);
});

test("rejects source, dot evaluation, eval and shell -c in deployment shell scripts", () => {
  const violations = inspectShellSource(
    `
      # source "$DEPLOY_ENV_FILE"
      source "$DEPLOY_ENV_FILE"
      . "$OTHER_FILE"
      eval "$COMMAND"
      bash -c "$COMMAND"
      sh -c 'echo unsafe'
    `,
    "deploy.sh"
  );

  assert.equal(violations.length, 5);
  assert.match(violations[0], /source\/dot syntax/);
  assert.match(violations[2], /uses eval/);
  assert.match(violations[3], /shell with -c/);
});

test("accepts argument-array command execution and inert output text", () => {
  assert.deepEqual(
    inspectShellSource(
      `
        echo 'source "$DEPLOY_ENV_FILE" is forbidden'
        node scripts/deploy/promote-release.mjs
        docker compose config --quiet
      `,
      "safe.sh"
    ),
    []
  );
});

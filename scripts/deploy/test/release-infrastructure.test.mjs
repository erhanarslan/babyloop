import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { auditRuntimeEnv } from "../runtime-env-lib.mjs";

async function readWorkflow(name) {
  return readFile(`.github/workflows/${name}`, "utf8");
}

test("staging and production example contracts preserve shared-provider isolation", async () => {
  for (const environment of ["staging", "production"]) {
    const audit = await auditRuntimeEnv({
      envFile: `deploy/env/${environment}.env.example`,
      target: environment,
      allowExample: true
    });
    assert.equal(
      audit.values.RAG_REDIS_KEY_PREFIX,
      `babyloop:${environment}:rag`
    );
    assert.match(audit.values.RAG_QDRANT_COLLECTION, new RegExp(environment, "u"));
  }
});

test("database safety refuses identical staging and production targets before connecting", () => {
  const databaseUrl = "postgresql://user:password@db.invalid/babyloop_staging";
  const result = spawnSync(process.execPath, [
    "scripts/ops/database-release-safety.mjs",
    "--phase=preflight"
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      OTHER_ENV_DATABASE_URL: databaseUrl,
      EXPECTED_DATABASE_NAME: "babyloop_staging",
      MIGRATION_ENVIRONMENT: "staging"
    }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not equal OTHER_ENV_DATABASE_URL/u);
  assert.doesNotMatch(result.stderr, /password/u);
});

test("environment smoke target fails closed and full smoke inventory is present", async () => {
  const invalid = spawnSync(process.execPath, [
    "scripts/deploy/run-environment-smoke.mjs",
    "preview"
  ], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /staging or production/u);

  const [source, deploymentLib] = await Promise.all([
    readFile("scripts/deploy/post-deploy-smoke.mjs", "utf8"),
    readFile("scripts/deploy/deployment-lib.mjs", "utf8")
  ]);
  for (const token of [
    "api-openapi",
    "api-capabilities",
    "api-listings",
    "web-login",
    "backoffice-login",
    "ragVectorStore",
    "ragRedis",
    "DEPLOY_WORKER_BOOTSTRAP_GRACE_SECONDS",
    "operationalPolicy"
  ]) {
    assert.match(source, new RegExp(token, "u"));
  }
  assert.match(deploymentLib, /scheduledInfrastructure/u);
  assert.match(deploymentLib, /latestCreatedExecution === null/u);
});

test("staging merges automatically run the reusable CI gate before deployment", async () => {
  const [ci, staging] = await Promise.all([
    readWorkflow("ci.yml"),
    readWorkflow("deploy-staging.yml")
  ]);

  assert.match(ci, /^  pull_request:\n    branches: \[staging, master\]$/mu);
  assert.doesNotMatch(ci, /^  push:/mu);
  assert.match(staging, /^  push:\n    branches: \[staging\]$/mu);
  assert.match(staging, /group: deploy-staging/u);
  assert.match(staging, /cancel-in-progress: true/u);
  assert.match(staging, /uses: \.\/\.github\/workflows\/ci\.yml/u);
  assert.match(staging, /needs: ci/u);
  assert.match(staging, /push\|workflow_dispatch/u);
  assert.match(staging, /test "\$GITHUB_REF" = "refs\/heads\/staging"/u);

  const orderedSteps = [
    "Database postflight",
    "Deploy services and workers",
    "Staging smoke",
    "Record immutable deployment metadata"
  ];
  let cursor = -1;
  for (const step of orderedSteps) {
    const index = staging.indexOf(`name: ${step}`, cursor + 1);
    assert.ok(index > cursor, `${step} must appear in deployment order`);
    cursor = index;
  }
});

test("CI builds release packages as distinct diagnostic steps without mobile", async () => {
  const ci = await readWorkflow("ci.yml");
  for (const [label, target] of [
    ["shared", "shared"],
    ["API", "api"],
    ["web", "web"],
    ["backoffice", "backoffice"]
  ]) {
    assert.match(ci, new RegExp(`name: Build ${label} package\\n\\s+run: pnpm --filter @babyloop/${target} build`, "u"));
  }
  assert.doesNotMatch(ci, /run: pnpm build/u);
  assert.doesNotMatch(ci, /pnpm --filter @babyloop\/mobile build/u);
});

test("CI builds the database workspace package before fresh migration regression", async () => {
  const [ci, databasePackageSource, migrationTest] = await Promise.all([
    readWorkflow("ci.yml"),
    readFile("packages/database/package.json", "utf8"),
    readFile("apps/api/test/fresh-migration-chain.test.ts", "utf8")
  ]);
  const databaseBuild = "name: Build database package\n        run: pnpm --filter @babyloop/database build";
  const freshMigration = "name: Fresh migration regression\n        run: pnpm test:api:fresh-migrations";

  assert.ok(ci.indexOf(databaseBuild) >= 0);
  assert.ok(ci.indexOf(databaseBuild) < ci.indexOf(freshMigration));
  assert.match(migrationTest, /from "@babyloop\/database"/u);
  assert.doesNotMatch(migrationTest, /packages\/database\/(?:src|dist)/u);

  const databasePackage = JSON.parse(databasePackageSource);
  assert.deepEqual(databasePackage.exports["."], {
    types: "./dist/index.d.ts",
    import: "./dist/index.js"
  });
});

test("image scans report all findings but block fixable CRITICAL findings on immutable digests", async () => {
  const [containerImages, staging, production] = await Promise.all([
    readWorkflow("container-images.yml"),
    readWorkflow("deploy-staging.yml"),
    readWorkflow("promote-production.yml")
  ]);

  for (const source of [containerImages, staging, production]) {
    assert.match(source, /aquasecurity\/trivy-action@v0\.36\.0/u);
    assert.match(source, /severity: HIGH,CRITICAL\n\s+ignore-unfixed: false\n\s+exit-code: "0"/u);
    assert.match(source, /severity: CRITICAL\n\s+ignore-unfixed: true\n\s+exit-code: "1"/u);
  }
  assert.match(containerImages, /@\$\{\{ steps\.build\.outputs\.digest \}\}/u);
  assert.match(staging, /image-ref: \$\{\{ steps\.images\.outputs\.api \}\}/u);
  assert.match(production, /Resolve promoted immutable images/u);
  assert.match(production, /\*@sha256:\*/u);
  assert.match(production, /Promote exact staging image digests/u);
  assert.doesNotMatch(production, /docker\/build-push-action|gcp:cloud-run:build/u);
});

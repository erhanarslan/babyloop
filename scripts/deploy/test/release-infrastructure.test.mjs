import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { auditRuntimeEnv } from "../runtime-env-lib.mjs";

async function readWorkflow(name) {
  return readFile(`.github/workflows/${name}`, "utf8");
}

test("runtime examples declare the single-environment topology", async () => {
  for (const environment of ["staging", "production"]) {
    const audit = await auditRuntimeEnv({
      envFile: `deploy/env/${environment}.env.example`,
      target: environment,
      allowExample: true
    });
    assert.equal(
      audit.values.DEPLOY_TOPOLOGY,
      "single_environment"
    );
  }
});

test("single-environment database safety does not require cross-environment fingerprints", () => {
  const databaseUrl = "postgresql://user:password@127.0.0.1:1/babyloop_primary";
  const result = spawnSync(process.execPath, [
    "scripts/ops/database-release-safety.mjs",
    "--phase=preflight"
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DEPLOY_TOPOLOGY: "single_environment",
      EXPECTED_DATABASE_NAME: "babyloop_primary",
      MIGRATION_ENVIRONMENT: "production"
    }
  });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /OTHER_ENV_DATABASE_FINGERPRINT|OTHER_ENV_QDRANT_API_KEY_SHA256/u);
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

  const [source, deploymentLib, smokeContract] = await Promise.all([
    readFile("scripts/deploy/post-deploy-smoke.mjs", "utf8"),
    readFile("scripts/deploy/deployment-lib.mjs", "utf8"),
    readFile("scripts/deploy/deployment-smoke-contract.mjs", "utf8")
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
  assert.ok(source.indexOf("capabilitiesDefinition") < source.indexOf("planOpenApiProbe(runtimeCapabilities)"));
  assert.match(smokeContract, /runtime_docs_disabled/u);
  assert.doesNotMatch(source, /acceptedStatuses:\s*\[200,\s*404\]/u);
});

test("staging pushes run CI and static rehearsal without any GCP mutation surface", async () => {
  const [ci, staging] = await Promise.all([
    readWorkflow("ci.yml"),
    readWorkflow("deploy-staging.yml")
  ]);

  assert.match(ci, /^  pull_request:\n    branches: \[staging, master\]$/mu);
  assert.doesNotMatch(ci, /^  push:/mu);
  assert.match(staging, /^  push:\n    branches: \[staging\]$/mu);
  assert.match(staging, /group: validate-staging/u);
  assert.match(staging, /cancel-in-progress: true/u);
  assert.match(staging, /uses: \.\/\.github\/workflows\/ci\.yml/u);
  assert.match(staging, /needs: ci/u);
  assert.match(staging, /test "\$GITHUB_REF" = "refs\/heads\/staging"/u);
  assert.match(staging, /Static staging release rehearsal/u);
  for (const forbidden of [
    "google-github-actions/auth",
    "gcp:cloud-run:secrets",
    "gcp:cloud-run:build",
    "gcp:cloud-run:deploy",
    "gcp:cloud-run:migrate",
    "postgres-backup",
    "scheduler jobs",
    "run jobs execute"
  ]) {
    assert.doesNotMatch(staging, new RegExp(forbidden, "u"));
  }
});

test("production deploys master to the single physical project without cross-project promotion", async () => {
  const production = await readWorkflow("promote-production.yml");
  const orderedSteps = [
    "Materialize protected runtime contract",
    "Audit runtime contract",
    "Production release rehearsal preflight",
    "Import pinned Secret Manager versions",
    "Build immutable production images",
    "Resolve immutable production images",
    "Production database preflight",
    "Mandatory encrypted backup",
    "Deploy migration job only",
    "Execute production migration",
    "Production database postflight",
    "Deploy production services and workers",
    "Resolve release contract",
    "Production smoke",
    "Record immutable deployment metadata"
  ];
  let cursor = -1;
  for (const step of orderedSteps) {
    const index = production.indexOf(`name: ${step}`, cursor + 1);
    assert.ok(index > cursor, `${step} must appear in production deployment order`);
    cursor = index;
  }
  assert.match(production, /environment: production/u);
  assert.match(production, /GCP_PROJECT_ID: babyloop-staging/u);
  assert.match(production, /DEPLOY_TOPOLOGY: \$\{\{ vars\.DEPLOY_TOPOLOGY \}\}/u);
  assert.doesNotMatch(production, /source-environment|promote-images|Resolve verified staging SHA/u);
  assert.match(production, /deploy:rehearse:production/u);
  assert.match(production, /scripts\/deploy\/write-release-summary\.mjs/u);
});

test("database rehearsal preflight enforces a read-only PostgreSQL session", async () => {
  const source = await readFile("scripts/ops/database-release-safety.mjs", "utf8");
  assert.match(source, /default_transaction_read_only=on/u);
  assert.match(source, /show transaction_read_only/u);
  assert.match(source, /transactionReadOnlyVerified/u);
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

  for (const source of [containerImages, production]) {
    assert.match(source, /aquasecurity\/trivy-action@v0\.36\.0/u);
    assert.match(source, /severity: HIGH,CRITICAL\n\s+ignore-unfixed: false\n\s+exit-code: "0"/u);
    assert.match(source, /severity: CRITICAL\n\s+ignore-unfixed: true\n\s+exit-code: "1"/u);
  }
  assert.match(containerImages, /@\$\{\{ steps\.build\.outputs\.digest \}\}/u);
  assert.doesNotMatch(staging, /aquasecurity\/trivy-action|image-ref:/u);
  assert.match(production, /Resolve immutable production images/u);
  assert.match(production, /\*@sha256:\*/u);
  assert.match(production, /gcp:cloud-run:build/u);
  assert.doesNotMatch(production, /Promote exact staging image digests|source-environment/u);
});

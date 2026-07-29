import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertMutationTarget,
  loadCloudRunContract,
  validateDeploymentTopology
} from "../../gcp/cloud-run-lib.mjs";
import { validateImageBuildRuntime } from "../../gcp/build-cloud-run-images.mjs";
import { captureRollbackSnapshot } from "../capture-cloud-run-rollback.mjs";
import { writeJsonReceipt } from "../deployment-lib.mjs";
import { auditRuntimeEnv } from "../runtime-env-lib.mjs";
import {
  RUNTIME_IDENTIFIER_KEYS,
  verifyRuntimeIdentifierContinuity
} from "../runtime-identifier-continuity.mjs";

test("single physical production project contract is exact and staging is non-deployable", async () => {
  const { contract } = await loadCloudRunContract();
  assert.equal(contract.topology, "single_environment");
  assert.equal(contract.environments.staging.deployable, false);
  assert.equal(contract.environments.production.deployable, true);
  assert.equal(contract.environments.production.projectId, "babyloop-staging");
  assert.deepEqual(contract.environments.production.publicDomains, {
    web: "https://babyloop.com.tr",
    api: "https://api.babyloop.com.tr",
    backoffice: "https://admin.babyloop.com.tr"
  });
  assert.deepEqual(Object.values(contract.services).map(({ name }) => name), [
    "babyloop-api",
    "babyloop-web",
    "babyloop-backoffice"
  ]);
  assert.deepEqual(Object.values(contract.jobs).map(({ name }) => name), [
    "babyloop-migrate",
    "babyloop-notification-worker",
    "babyloop-child-reminder-worker"
  ]);
});

test("unknown topology, wrong physical project, and staging mutation fail closed", async () => {
  const { contract } = await loadCloudRunContract();
  const unknown = structuredClone(contract);
  unknown.topology = "unknown";
  assert.throws(() => validateDeploymentTopology(unknown), /single_environment/u);

  const wrongProject = structuredClone(contract);
  wrongProject.projects.production = ["babyloop", "production"].join("-");
  wrongProject.environments.production.projectId = wrongProject.projects.production;
  assert.throws(() => validateDeploymentTopology(wrongProject), /approved single physical project/u);
  await assert.rejects(
    assertMutationTarget(contract, "staging", {
      env: {
        DEPLOY_TOPOLOGY: "single_environment",
        GITHUB_ACTIONS: "true",
        GITHUB_REF: "refs/heads/staging"
      },
      resolveWorktreeStatus: async () => ""
    }),
    /logical environment production/u
  );
});

test("production runtime example requires exact public domains and rejects staging domains", async () => {
  const valid = await auditRuntimeEnv({
    envFile: "deploy/env/production.env.example",
    target: "production",
    allowExample: true
  });
  assert.equal(valid.values.DEPLOY_TOPOLOGY, "single_environment");
  assert.equal(valid.values.WEB_APP_URL, "https://babyloop.com.tr");
  assert.equal(valid.values.GOOGLE_REDIRECT_URI, "https://api.babyloop.com.tr/api/v1/auth/google/callback");

  const directory = await mkdtemp(join(tmpdir(), "babyloop-single-environment-"));
  try {
    const source = await readFile("deploy/env/production.env.example", "utf8");
    const invalidPath = join(directory, "production.env.example");
    await writeFile(
      invalidPath,
      source.replaceAll("https://babyloop.com.tr", "https://staging.babyloop.com.tr"),
      "utf8"
    );
    await assert.rejects(
      auditRuntimeEnv({ envFile: invalidPath, target: "production", allowExample: true }),
      /must equal https:\/\/babyloop\.com\.tr|CORS_ORIGINS must contain exactly/u
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("existing production services are captured as exact restorable traffic without bootstrap confirmation", async () => {
  const { contract } = await loadCloudRunContract();
  const directory = await mkdtemp(join(tmpdir(), "babyloop-existing-production-"));
  try {
    const result = await captureRollbackSnapshot({
      environment: "production",
      cloudRunContract: contract,
      outputPath: join(directory, "rollback.json"),
      execute: async (args) => {
        const service = args[3];
        return {
          stdout: JSON.stringify({
            metadata: { name: service },
            status: {
              traffic: service === "babyloop-api"
                ? [
                    { revisionName: "babyloop-api-00002-def", percent: 10 },
                    { revisionName: "babyloop-api-00001-abc", percent: 90 }
                  ]
                : [{ revisionName: `${service}-00001-abc`, percent: 100 }]
            }
          })
        };
      }
    });
    assert.equal(result.snapshot.project, "babyloop-staging");
    for (const service of Object.values(result.snapshot.services)) {
      assert.equal(service.state, "existing");
      assert.equal(service.rollbackCapability, "exact_traffic_restorable");
      assert.equal(service.traffic.reduce((sum, item) => sum + item.percent, 0), 100);
    }
    assert.deepEqual(result.snapshot.services.api.traffic, [
      { revisionName: "babyloop-api-00002-def", percent: 10 },
      { revisionName: "babyloop-api-00001-abc", percent: 90 }
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("workflows enforce validation-only staging and approved single-project production", async () => {
  const [staging, production, smoke] = await Promise.all([
    readFile(".github/workflows/deploy-staging.yml", "utf8"),
    readFile(".github/workflows/promote-production.yml", "utf8"),
    readFile("scripts/deploy/post-deploy-smoke.mjs", "utf8")
  ]);
  assert.match(staging, /uses: \.\/\.github\/workflows\/ci\.yml/u);
  assert.doesNotMatch(staging, /google-github-actions\/auth|gcp:cloud-run:(?:secrets|build|deploy|migrate)|postgres-backup/u);
  assert.match(production, /environment: production/u);
  assert.match(production, /GCP_PROJECT_ID: babyloop-staging/u);
  assert.match(production, /PRODUCTION_RELEASE_APPROVED/u);
  assert.match(production, /DEPLOY_TOPOLOGY/u);
  assert.match(production, /CURRENT_RUNTIME_IDENTIFIER_INVENTORY_JSON/u);
  assert.doesNotMatch(production, /source-environment|promote-images/u);
  for (const token of [
    "Production database preflight",
    "Mandatory encrypted backup",
    "Production database postflight",
    "Production smoke"
  ]) assert.match(production, new RegExp(token, "u"));
  assert.match(smoke, /environment === "staging" \? 360 : 0/u);
});

test("existing provider and worker identifiers are retained or require explicit migration evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-runtime-continuity-"));
  try {
    const identifiers = Object.fromEntries(RUNTIME_IDENTIFIER_KEYS.map((key) => [key, `${key.toLowerCase()}-existing`]));
    identifiers.RAG_QDRANT_URL = "https://qdrant.current.example";
    identifiers.S3_ENDPOINT = "https://storage.current.example";
    identifiers.IMAGE_STORAGE_PUBLIC_BASE_URL = "https://cdn.current.example";
    identifiers.RESEND_API_BASE_URL = "https://api.resend.com";
    identifiers.EXPO_PUSH_API_BASE_URL = "https://exp.host/--/api/v2/push/send";
    const inventoryPath = join(directory, "current-runtime-identifiers.json");
    await writeJsonReceipt(inventoryPath, {
      schemaVersion: 1,
      kind: "current_runtime_identifier_inventory",
      environment: "production",
      topology: "single_environment",
      identifiers
    });
    const audit = {
      environment: "production",
      values: { DEPLOY_TOPOLOGY: "single_environment", ...identifiers }
    };
    const unchanged = await verifyRuntimeIdentifierContinuity({ audit, inventoryPath });
    assert.equal(unchanged.verified, true);
    assert.deepEqual(unchanged.changedKeys, []);

    const changedIndexAudit = structuredClone(audit);
    changedIndexAudit.values.RAG_QDRANT_COLLECTION = "unbound-new-index";
    await assert.rejects(
      verifyRuntimeIdentifierContinuity({ audit: changedIndexAudit, inventoryPath }),
      /PROVIDER_IDENTIFIER_MIGRATION_CONFIRM.*RAG_QDRANT_COLLECTION/u
    );

    const changedWorkerAudit = structuredClone(audit);
    changedWorkerAudit.values.NOTIFICATION_PROVIDER_WORKER_ID = "new-worker-id";
    await assert.rejects(
      verifyRuntimeIdentifierContinuity({
        audit: changedWorkerAudit,
        inventoryPath,
        migrationConfirmation: "ALLOW_PROVIDER_IDENTIFIER_MIGRATION_PRODUCTION"
      }),
      /controlled worker verification evidence/u
    );
    const workerEvidencePath = join(directory, "worker-identifier-migration-evidence.json");
    await writeJsonReceipt(workerEvidencePath, {
      schemaVersion: 1,
      kind: "worker_identifier_migration_evidence",
      environment: "production",
      status: "passed",
      changedKeys: ["NOTIFICATION_PROVIDER_WORKER_ID"]
    });
    const changedWorker = await verifyRuntimeIdentifierContinuity({
      audit: changedWorkerAudit,
      inventoryPath,
      migrationConfirmation: "ALLOW_PROVIDER_IDENTIFIER_MIGRATION_PRODUCTION",
      workerEvidencePath
    });
    assert.equal(changedWorker.workerMigrationEvidenceVerified, true);
    assert.deepEqual(changedWorker.changedKeys, ["NOTIFICATION_PROVIDER_WORKER_ID"]);
    await assert.rejects(
      verifyRuntimeIdentifierContinuity({ audit, inventoryPath: "" }),
      /CURRENT_RUNTIME_IDENTIFIER_INVENTORY_PATH is required/u
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("production image build audits the runtime before gcloud or Docker mutation", async () => {
  const source = await readFile("scripts/gcp/build-cloud-run-images.mjs", "utf8");
  const validationAt = source.indexOf("await validateImageBuildRuntime");
  const contextAt = source.indexOf("await assertGcloudContext");
  const dockerAuthAt = source.indexOf('await gcloud(["auth", "configure-docker"');
  const dockerBuildAt = source.indexOf('await run("docker", args)');
  assert.ok(validationAt >= 0 && validationAt < contextAt);
  assert.ok(contextAt < dockerAuthAt && dockerAuthAt < dockerBuildAt);
  assert.ok(source.indexOf("await audit({") < source.indexOf("await verifyContinuity({"));

  const directory = await mkdtemp(join(tmpdir(), "babyloop-build-runtime-audit-"));
  try {
    const example = await readFile("deploy/env/production.env.example", "utf8");
    let continuityCalls = 0;
    const verifyContinuity = async () => {
      continuityCalls += 1;
      throw new Error("continuity must not run after a failed runtime audit");
    };
    for (const [name, content, pattern] of [
      ["staging-url", example.replace("WEB_APP_URL=https://babyloop.com.tr", "WEB_APP_URL=https://staging.babyloop.com.tr"), /WEB_APP_URL must equal/u],
      ["wrong-topology", example.replace("DEPLOY_TOPOLOGY=single_environment", "DEPLOY_TOPOLOGY=dual_environment"), /DEPLOY_TOPOLOGY must equal/u]
    ]) {
      const path = join(directory, `${name}.env`);
      await writeFile(path, content, { encoding: "utf8", mode: 0o600 });
      await assert.rejects(
        validateImageBuildRuntime({
          environment: "production",
          envFile: path,
          verifyContinuity
        }),
        pattern
      );
    }
    const placeholderPath = join(directory, "production.env");
    await writeFile(placeholderPath, example, { encoding: "utf8", mode: 0o600 });
    await assert.rejects(
      validateImageBuildRuntime({
        environment: "production",
        envFile: placeholderPath,
        verifyContinuity
      }),
      /placeholder/u
    );
    assert.equal(continuityCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("first production cutover prerequisites have one exact deadlock-free order", async () => {
  const source = await readFile("docs/93-gcp-cloud-run-deployment.md", "utf8");
  const ordered = [
    "topic branch into `staging`",
    "staging validation workflow to pass",
    "GitHub `production` Environment variables and secrets",
    "Verify WIF/IAM",
    "Prepare the production runtime contract, but do not deploy",
    "Pre-create production domain mappings",
    "Cloudflare DNS-only records",
    "managed certificates report `True`",
    "production domains return HTTP/TLS responses",
    "Google OAuth client",
    "`staging` → `master` release PR",
    "production workflow deploy",
    "mandatory production smoke",
    "remove the `staging.*` mappings"
  ];
  let cursor = -1;
  for (const token of ordered) {
    const index = source.indexOf(token, cursor + 1);
    assert.ok(index > cursor, `${token} must appear in exact cutover order`);
    cursor = index;
  }
  assert.match(source, /live read-only rehearsal deliberately treats step 9 as a prerequisite/u);
  const workflow = await readFile(".github/workflows/promote-production.yml", "utf8");
  assert.doesNotMatch(workflow, /gcp:cloud-run:domains|domain-mappings (?:create|delete)|scheduler jobs.*domain/u);
});

test("artifact cleanup includes old SHA-tagged digests but protects every evidence set", async () => {
  const source = await readFile("docs/93-gcp-cloud-run-deployment.md", "utf8");
  for (const token of [
    "current service/job revision",
    "rollback snapshot",
    "last 10 releases",
    "buildcache",
    "old untagged digests",
    "old SHA-tagged release digests",
    "resolve every tag to its digest",
    "zero deletion",
    "DELETE_UNUSED_ARTIFACTS_PRODUCTION"
  ]) assert.match(source, new RegExp(token, "u"));
});

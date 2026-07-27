import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  assembleResolvedReleaseContract,
  buildProtectedReference,
  buildTrafficRollbackArgs,
  classifyProbeError,
  createReadOnlyGcloudExecutor,
  evaluateSmokeWarningPolicy,
  exactTrafficMatches,
  formatProbeFailure,
  initialServiceBootstrapPolicy,
  RELEASE_STAGES,
  requirePublicSurfaces,
  resolveSmokeTargets,
  runReleaseStageChecks,
  summarizeGcloudCommandAudit,
  validateResolvedReleaseContract,
  validateRollbackSnapshot,
  validateRollbackTraffic
} from "../release-orchestration-lib.mjs";
import { readJsonReceipt, writeJsonReceipt } from "../deployment-lib.mjs";
import { rehearseCloudRunRelease } from "../rehearse-cloud-run-release.mjs";
import {
  captureRollbackSnapshot,
  selectRollbackTraffic
} from "../capture-cloud-run-rollback.mjs";
import { rollbackCloudRunRelease } from "../rollback-cloud-run-release.mjs";
import { findBackupManifest } from "../resolve-release-contract.mjs";
import {
  API_DEPLOYMENT_SMOKE_ENDPOINTS,
  BACKOFFICE_DEPLOYMENT_SMOKE_ENDPOINTS,
  planOpenApiProbe,
  readRuntimeCapabilities,
  validateOpenApiProbeResponse,
  WEB_DEPLOYMENT_SMOKE_ENDPOINTS
} from "../deployment-smoke-contract.mjs";
import {
  buildSchedulerArgs,
  buildSchedulerDescribeArgs,
  buildSchedulerJobIamArgs,
  buildServiceDescribeArgs
} from "../../gcp/deploy-cloud-run.mjs";
import { loadCloudRunContract } from "../../gcp/cloud-run-lib.mjs";

const SHA = "a".repeat(40);
const CHECKSUM = "b".repeat(64);

test("deployment smoke targets require exact receipt URLs while canonical URLs remain public-only", () => {
  const receipt = deploymentReceipt("staging");
  const canonical = canonicalUrls();
  const targets = resolveSmokeTargets({
    environment: "staging",
    deploymentReceipt: receipt,
    canonicalPublicUrls: canonical
  });
  assert.equal(targets.deployment.api, "https://api-deployment.example.test");
  assert.equal(targets.public.api, "https://api-canonical.example.test");
  assert.equal(targets.policy.publicRequired, false);
  assert.throws(() => resolveSmokeTargets({
    environment: "staging",
    deploymentReceipt: null,
    canonicalPublicUrls: canonical
  }), /checksum-verified Cloud Run services deployment receipt is required/u);
});

test("public surface policy is optional by default in staging and mandatory in production", () => {
  assert.equal(requirePublicSurfaces("staging", undefined), false);
  assert.equal(requirePublicSurfaces("staging", "true"), true);
  assert.equal(requirePublicSurfaces("production", "false"), true);
  const targets = resolveSmokeTargets({
    environment: "production",
    deploymentReceipt: deploymentReceipt("production"),
    canonicalPublicUrls: canonicalUrls(),
    requirePublicSurfaces: false
  });
  assert.equal(targets.policy.publicRequired, true);
});

test("capabilities disable OpenAPI without a request or warning and preserve skipped evidence", () => {
  const capabilities = readRuntimeCapabilities({
    ok: true,
    data: {
      docs: { enabled: false, accessMode: "readonly" },
      modules: { marketplace: true, analytics: true }
    }
  });
  const plan = planOpenApiProbe(capabilities);
  assert.equal(plan.request, false);
  assert.deepEqual(plan.evidence, {
    status: "skipped",
    reason: "runtime_docs_disabled",
    required: false
  });
  assert.equal(plan.outcome.status, "skipped_runtime_disabled");
});

test("enabled OpenAPI requires HTTP 200, application/json and a valid OpenAPI 3 document", () => {
  const capabilities = readRuntimeCapabilities({
    ok: true,
    data: {
      docs: { enabled: true, accessMode: "readonly" },
      modules: { marketplace: true, analytics: true }
    }
  });
  assert.equal(planOpenApiProbe(capabilities).request, true);
  assert.equal(validateOpenApiProbeResponse({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: { openapi: "3.0.3" }
  }), true);
  assert.throws(() => validateOpenApiProbeResponse({
    status: 404,
    contentType: "application/json",
    body: { openapi: "3.0.3" }
  }), /HTTP 404/u);
  for (const status of [401, 403]) {
    assert.throws(() => validateOpenApiProbeResponse({
      status,
      contentType: "application/json",
      body: { openapi: "3.0.3" }
    }), new RegExp(`HTTP ${status}`, "u"));
  }
  assert.throws(() => validateOpenApiProbeResponse({
    status: 200,
    contentType: "application/json",
    body: "{malformed"
  }), /valid OpenAPI 3 document/u);
});

test("malformed or incomplete capabilities docs fields fail closed", () => {
  for (const body of [
    { ok: true, data: { docs: {}, modules: { marketplace: true, analytics: true } } },
    { ok: true, data: { docs: { enabled: false }, modules: { marketplace: true, analytics: true } } },
    { ok: true, data: { docs: { enabled: false, accessMode: "write" }, modules: { marketplace: true, analytics: true } } },
    { ok: true, data: { docs: { enabled: false, accessMode: "readonly" }, modules: { marketplace: false, analytics: true } } }
  ]) assert.throws(() => readRuntimeCapabilities(body), /capabilities response/u);
});

test("shared smoke route contract maps to real web and backoffice route files", async () => {
  const directWebRoutes = new Map([
    ["/", "apps/web/src/app/page.tsx"],
    ["/login", "apps/web/src/app/login/page.tsx"],
    ["/browse", "apps/web/src/app/browse/page.tsx"],
    ["/support/contact", "apps/web/src/app/support/contact/page.tsx"]
  ]);
  const legalSource = await readFile("apps/web/src/features/legal/legal-documents.ts", "utf8");
  await access("apps/web/src/app/legal/[slug]/page.tsx");
  for (const endpoint of WEB_DEPLOYMENT_SMOKE_ENDPOINTS) {
    if (endpoint.path.startsWith("/legal/")) {
      assert.match(legalSource, new RegExp(`"${endpoint.path.slice("/legal/".length)}"`, "u"));
    } else {
      await access(directWebRoutes.get(endpoint.path));
    }
  }
  assert.deepEqual(BACKOFFICE_DEPLOYMENT_SMOKE_ENDPOINTS, [{
    name: "backoffice-login",
    path: "/login"
  }]);
  await access("apps/backoffice/src/app/login/page.tsx");
  assert.ok(API_DEPLOYMENT_SMOKE_ENDPOINTS.some(({ name, conditional }) => (
    name === "api-openapi" && conditional === "capabilities.docs.enabled"
  )));
});

test("performance enforcement does not promote optional staging public warnings to blockers", () => {
  const staging = evaluateSmokeWarningPolicy({
    environment: "staging",
    publicRequired: false,
    enforcePerformance: true,
    optionalPublicSurfaceWarnings: ["canonical DNS is unavailable"]
  });
  assert.equal(staging.status, "passed_with_warnings");
  assert.deepEqual(staging.blockers, []);
  assert.equal(staging.acceptance.canonicalPublicSurfaces, "unavailable_warning");
  assert.equal(staging.acceptance.publicAcceptance, "not_complete");

  const performance = evaluateSmokeWarningPolicy({
    environment: "staging",
    publicRequired: false,
    enforcePerformance: true,
    performanceWarnings: ["p95 exceeded"]
  });
  assert.deepEqual(performance.blockers, ["p95 exceeded"]);

  const production = evaluateSmokeWarningPolicy({
    environment: "production",
    publicRequired: true,
    enforcePerformance: false,
    optionalPublicSurfaceWarnings: ["public TLS failed"]
  });
  assert.deepEqual(production.blockers, ["public TLS failed"]);
});

test("read-only gcloud executor audits allowed commands and rejects mutation before execution", async () => {
  const underlyingCalls = [];
  const executor = createReadOnlyGcloudExecutor(async (args) => {
    underlyingCalls.push(args);
    return { stdout: "ok\n", stderr: "" };
  });

  await executor.execute([
    "run", "services", "describe", "babyloop-api",
    "--project=babyloop-staging"
  ], { capture: true });
  await assert.rejects(
    executor.execute([
      "run", "services", "update-traffic", "babyloop-api",
      "--to-revisions=babyloop-api-00001-abc=100"
    ]),
    /rejected gcloud run services update-traffic before execution/u
  );

  assert.equal(underlyingCalls.length, 1);
  const audit = summarizeGcloudCommandAudit(executor.audit);
  assert.equal(audit.executedReadOnlyCommandCount, 1);
  assert.equal(audit.rejectedMutationCommandCount, 1);
  assert.equal(audit.mutationCommandsExecuted, false);
  assert.deepEqual(audit.executedReadOnlyCommands, [{ commandPath: "run services describe" }]);
  assert.doesNotMatch(JSON.stringify(audit), /babyloop-api|to-revisions/u);
});

test("initial service bootstrap policy is explicit for both environments and fail-closed in production", () => {
  assert.deepEqual(initialServiceBootstrapPolicy("staging").allowed, true);
  assert.equal(initialServiceBootstrapPolicy("staging").mode, "staging_initial_bootstrap_allowed");
  assert.equal(initialServiceBootstrapPolicy("production").allowed, false);
  assert.equal(initialServiceBootstrapPolicy(
    "production",
    "ALLOW_INITIAL_SERVICE_BOOTSTRAP_PRODUCTION"
  ).allowed, true);
});

test("same exact deployment and canonical origin is explicitly deduplicated", () => {
  const receipt = deploymentReceipt("staging");
  const targets = resolveSmokeTargets({
    environment: "staging",
    deploymentReceipt: receipt,
    canonicalPublicUrls: {
      ...canonicalUrls(),
      api: receipt.urls.api
    }
  });
  assert.deepEqual(targets.duplicateRoles, ["api"]);
});

test("missing and corrupt receipts fail checksum verification without fallback", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-release-receipt-"));
  try {
    const path = join(directory, "deployment.json");
    await assert.rejects(readJsonReceipt(path), /ENOENT/u);
    await writeJsonReceipt(path, deploymentReceipt("staging"));
    await writeFile(path, "{}\n", "utf8");
    await assert.rejects(readJsonReceipt(path), /Receipt checksum verification failed/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("service URL read-back mismatch is fail-closed", async () => {
  const { assertServiceUrlReadBack } = await import("../release-orchestration-lib.mjs");
  assert.doesNotThrow(() => assertServiceUrlReadBack(deploymentReceipt("staging").urls, deploymentReceipt("staging").urls));
  assert.throws(() => assertServiceUrlReadBack(deploymentReceipt("staging").urls, {
    ...deploymentReceipt("staging").urls,
    api: "https://wrong.example.test"
  }), /URL read-back does not match/u);
});

for (const [code, expected] of [
  ["ENOTFOUND", "dns_not_found"],
  ["EAI_AGAIN", "dns_temporary_failure"],
  ["ECONNREFUSED", "connection_refused"],
  ["ECONNRESET", "connection_reset"],
  ["UND_ERR_CONNECT_TIMEOUT", "connect_timeout"],
  ["UND_ERR_HEADERS_TIMEOUT", "request_timeout"],
  ["CERT_HAS_EXPIRED", "tls_certificate_expired"],
  ["ERR_TLS_CERT_ALTNAME_INVALID", "tls_hostname_mismatch"],
  ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "tls_unknown_ca"],
  ["ERR_FR_TOO_MANY_REDIRECTS", "redirect_loop"]
]) {
  test(`network diagnostics classify ${code} without leaking request data`, () => {
    const cause = Object.assign(new Error("token=should-not-appear"), { code });
    const error = new Error("fetch failed", { cause });
    const diagnostic = classifyProbeError(error, {
      probe: "api-liveness",
      url: "https://api.example.test/health/live?authorization=secret",
      attempt: 3,
      elapsedMs: 1250
    });
    assert.equal(diagnostic.errorClass, expected);
    const output = formatProbeFailure(diagnostic);
    assert.match(output, /origin=https:\/\/api\.example\.test/u);
    assert.doesNotMatch(output, /authorization|secret|should-not-appear|health\/live/u);
  });
}

test("probe diagnostics classify HTTP, malformed JSON, validation, body limit, and unsupported protocol", () => {
  for (const [errorClass, expected] of [
    ["http_status", "http_status"],
    ["malformed_json", "malformed_json"],
    ["response_validation", "response_validation"],
    ["response_body_limit", "response_body_limit"],
    ["unsupported_protocol", "unsupported_protocol"]
  ]) {
    assert.equal(classifyProbeError(new Error("failed"), {
      probe: "probe",
      url: "https://example.test/path?token=redacted",
      errorClass,
      status: errorClass === "http_status" ? 503 : undefined
    }).errorClass, expected);
  }
});

test("scheduler create/update and read-only command builders preserve exact CLI flags", async () => {
  const { contract } = await loadCloudRunContract();
  const context = { project: contract.projects.staging };
  const config = contract.jobs.notification;
  const common = { key: "notification", config, context, contract, environment: "staging" };
  const create = buildSchedulerArgs({ ...common, verb: "create" });
  const update = buildSchedulerArgs({ ...common, verb: "update" });
  assert.ok(create.includes("--headers=Content-Type=application/json"));
  assert.ok(update.includes("--update-headers=Content-Type=application/json"));
  assert.deepEqual(buildServiceDescribeArgs({ config: contract.services.api, context, contract }).slice(0, 3), ["run", "services", "describe"]);
  assert.deepEqual(buildSchedulerDescribeArgs({ config, context, contract }).slice(0, 3), ["scheduler", "jobs", "describe"]);
  assert.deepEqual(buildSchedulerJobIamArgs({ config, context, contract }).slice(0, 4), ["run", "jobs", "add-iam-policy-binding", config.name]);
  assert.doesNotMatch(JSON.stringify([create, update]), /jobs","execute/u);
});

test("rehearsal represents all twenty stages and aggregates independent blockers", async () => {
  assert.equal(RELEASE_STAGES.length, 20);
  const failures = {
    "runtime-audit": "expected operational failure",
    "image-manifest": "malformed receipt",
    "backup-receipt": "missing receipt",
    "database-postflight": "checksum mismatch",
    "job-scoped-iam": "permission denied",
    "scheduler-create": "not found",
    "rollback": "stale resource"
  };
  const checks = Object.fromEntries(RELEASE_STAGES.map((stage) => [stage, async () => {
    if (failures[stage]) throw new Error(failures[stage]);
    return {};
  }]));
  const result = await runReleaseStageChecks(checks);
  assert.equal(result.ok, false);
  assert.equal(result.blockers.length, Object.keys(failures).length);
  assert.deepEqual(result.checkedStages.map(({ stage }) => stage), RELEASE_STAGES);
  for (const failure of Object.values(failures)) assert.match(result.blockers.join("\n"), new RegExp(failure, "u"));
});

test("local staging rehearsal executes no mutation and reaches final summary stage", async () => {
  const rehearsal = await rehearseCloudRunRelease({
    environment: "staging",
    envFile: "deploy/env/staging.env.example",
    allowExample: true,
    liveReadOnly: false
  });
  assert.equal(rehearsal.result.ok, true, rehearsal.result.blockers.join("\n"));
  assert.equal(rehearsal.evidence.mutationCommandsExecuted, false);
  assert.equal(rehearsal.evidence.executedReadOnlyCommandCount, 0);
  assert.equal(rehearsal.evidence.rejectedMutationCommandCount, 0);
  assert.equal(rehearsal.evidence.kind, "cloud_run_release_rehearsal");
  assert.equal(rehearsal.evidence.workflowPath, ".github/workflows/deploy-staging.yml");
  assert.equal(rehearsal.evidence.commandInventory.businessWorkerExecute, 0);
  assert.equal(rehearsal.result.checkedStages.at(-1).stage, "deployment-summary");
  assert.equal(rehearsal.result.checkedStages.length, RELEASE_STAGES.length);
});

test("local production rehearsal validates promotion workflow and production-only smoke policy", async () => {
  const rehearsal = await rehearseCloudRunRelease({
    environment: "production",
    envFile: "deploy/env/production.env.example",
    allowExample: true,
    liveReadOnly: false
  });
  assert.equal(rehearsal.result.ok, true, rehearsal.result.blockers.join("\n"));
  assert.equal(rehearsal.evidence.workflowPath, ".github/workflows/promote-production.yml");
  assert.equal(rehearsal.evidence.smokePolicy.requirePublicSurfaces, true);
  assert.equal(rehearsal.evidence.smokePolicy.workerBootstrapGraceSeconds, 0);
  assert.equal(rehearsal.evidence.mutationCommandsExecuted, false);
  assert.equal(rehearsal.evidence.executedReadOnlyCommandCount, 0);
});

test("live rehearsal evidence is derived from the audited commands actually executed", async () => {
  const { contract } = await loadCloudRunContract();
  const rehearsal = await rehearseCloudRunRelease({
    environment: "staging",
    envFile: "deploy/env/staging.env.example",
    allowExample: true,
    liveReadOnly: true,
    execute: fakeLiveGcloud(contract, "staging"),
    fetchImpl: async () => ({ ok: true, status: 200 })
  });
  assert.equal(rehearsal.result.ok, true, rehearsal.result.blockers.join("\n"));
  assert.ok(rehearsal.evidence.executedReadOnlyCommandCount > 0);
  assert.equal(
    rehearsal.evidence.executedReadOnlyCommandCount,
    rehearsal.evidence.commandAudit.executedReadOnlyCommands.length
  );
  assert.equal(rehearsal.evidence.rejectedMutationCommandCount, 0);
  assert.equal(rehearsal.evidence.mutationCommandsExecuted, false);
  assert.equal(rehearsal.evidence.status, "passed_with_warnings");
  assert.ok(rehearsal.evidence.commandAudit.executedReadOnlyCommands.every(
    ({ commandPath }) => !/ deploy| create| update| execute|add-iam-policy-binding|update-traffic/u.test(commandPath.replace(" --help", ""))
      || commandPath.endsWith("--help")
  ));
  const source = await readFile("scripts/deploy/rehearse-cloud-run-release.mjs", "utf8");
  assert.doesNotMatch(source, /executedCommands:\s*\[\]/u);
});

test("broken current service HTTP is a rehearsal warning, not a rollback blocker", async () => {
  const { contract } = await loadCloudRunContract();
  const rehearsal = await rehearseCloudRunRelease({
    environment: "staging",
    envFile: "deploy/env/staging.env.example",
    allowExample: true,
    liveReadOnly: true,
    execute: fakeLiveGcloud(contract, "staging"),
    fetchImpl: async (url) => String(url).includes("babyloop-api.example.test")
      ? { ok: false, status: 503 }
      : { ok: true, status: 200 }
  });
  assert.equal(rehearsal.result.ok, true, rehearsal.result.blockers.join("\n"));
  assert.match(rehearsal.result.warnings.join("\n"), /HTTP reachability warning.*503/u);
  assert.doesNotMatch(rehearsal.result.blockers.join("\n"), /503/u);
});

test("production live rehearsal fails closed for an absent service without bootstrap confirmation", async () => {
  const { contract } = await loadCloudRunContract();
  const baseExecute = fakeLiveGcloud(contract, "production");
  const absentServiceExecute = async (args, options) => {
    if (args.slice(0, 3).join(" ") === "run services describe") {
      throw new Error("NOT_FOUND: Cloud Run service is absent");
    }
    return baseExecute(args, options);
  };
  const rehearsal = await rehearseCloudRunRelease({
    environment: "production",
    envFile: "deploy/env/production.env.example",
    allowExample: true,
    liveReadOnly: true,
    execute: absentServiceExecute,
    fetchImpl: async () => ({ ok: true, status: 200 })
  });
  assert.equal(rehearsal.result.ok, false);
  assert.match(
    rehearsal.result.blockers.join("\n"),
    /GCP_INITIAL_SERVICE_BOOTSTRAP_CONFIRM=ALLOW_INITIAL_SERVICE_BOOTSTRAP_PRODUCTION/u
  );
  assert.equal(rehearsal.evidence.mutationCommandsExecuted, false);
});

test("resolved contract binds receipts, migration SHA, scheduler/IAM state, and rollback inputs", async () => {
  const { contract, sha256 } = await loadCloudRunContract();
  const references = Object.fromEntries([
    "imageManifest",
    "secretManifest",
    "migration",
    "deployment",
    "runtimeAudit",
    "databasePreflight",
    "databasePostflight",
    "rollbackSnapshot"
  ].map((key) => [key, buildProtectedReference(`/tmp/${key}.json`, CHECKSUM)]));
  const rollbackSnapshot = rollbackFixture(contract, "staging");
  const resolved = assembleResolvedReleaseContract({
    environment: "staging",
    cloudRunContract: contract,
    cloudRunContractSha256: sha256,
    gitSha: SHA,
    imageManifest: imageManifest(),
    deploymentReceipt: deploymentReceipt("staging", contract),
    migrationReceipt: migrationReceipt("staging", contract),
    databasePostflightReceipt: databasePostflight("staging"),
    canonicalPublicUrls: { ...canonicalUrls(), requirePublicSurfaces: "false" },
    references,
    rollbackSnapshot,
    backup: {
      directory: "/tmp/backups",
      manifestPath: "/tmp/backups/backup.manifest.json",
      primaryManifestChecksum: CHECKSUM,
      primaryArtifactChecksum: CHECKSUM,
      primaryArtifactBytes: 128,
      replicaArtifactChecksum: null,
      replicaArtifactBytes: null,
      replicaVerified: false,
      manifestChecksum: CHECKSUM,
      artifact: "backup.dump.age",
      artifactChecksum: CHECKSUM,
      encrypted: true
    }
  });
  assert.equal(validateResolvedReleaseContract(resolved, "staging"), resolved);
  assert.equal(resolved.smokePolicy.requirePublicSurfaces, false);
  assert.equal(resolved.schedulers.notification.exactConfigurationVerified, true);
  assert.equal(resolved.schedulers.notification.jobScopedIam.verified, true);
  assert.equal(resolved.migration.gitSha, SHA);
  assert.equal(resolved.probes.required.includes("api-openapi"), false);
  assert.deepEqual(resolved.probes.conditional, [{
    name: "api-openapi",
    condition: "capabilities.docs.enabled",
    endpoint: "/docs/json"
  }]);
  assert.deepEqual(resolved.rollback.services.api.traffic, [{
    revisionName: "babyloop-api-00001-abc",
    percent: 100
  }]);
  assert.throws(() => assembleResolvedReleaseContract({
    environment: "staging",
    cloudRunContract: contract,
    cloudRunContractSha256: sha256,
    gitSha: SHA,
    imageManifest: imageManifest(),
    deploymentReceipt: deploymentReceipt("staging", contract),
    migrationReceipt: { ...migrationReceipt("staging", contract), gitSha: "c".repeat(40) },
    databasePostflightReceipt: databasePostflight("staging"),
    canonicalPublicUrls: { ...canonicalUrls(), requirePublicSurfaces: "false" },
    references,
    rollbackSnapshot,
    backup: resolved.backup
  }), /Migration receipt gitSha does not match/u);
});

test("production resolved contract refuses an unverified backup replica", async () => {
  const { contract, sha256 } = await loadCloudRunContract();
  const references = Object.fromEntries([
    "imageManifest",
    "secretManifest",
    "migration",
    "deployment",
    "runtimeAudit",
    "databasePreflight",
    "databasePostflight",
    "rollbackSnapshot"
  ].map((key) => [key, buildProtectedReference(`/tmp/${key}.json`, CHECKSUM)]));
  assert.throws(() => assembleResolvedReleaseContract({
    environment: "production",
    cloudRunContract: contract,
    cloudRunContractSha256: sha256,
    gitSha: SHA,
    imageManifest: imageManifest(),
    deploymentReceipt: deploymentReceipt("production", contract),
    migrationReceipt: migrationReceipt("production", contract),
    databasePostflightReceipt: databasePostflight("production"),
    canonicalPublicUrls: { ...canonicalUrls(), requirePublicSurfaces: "true" },
    references,
    rollbackSnapshot: rollbackFixture(contract, "production"),
    backup: {
      directory: "/tmp/backups",
      manifestPath: "/tmp/backups/backup.manifest.json",
      artifact: "backup.dump.age",
      replicaVerified: false
    }
  }), /byte-verified backup replica/u);
});

test("rollback traffic capture and command builder preserve single and split distributions exactly", async () => {
  const { contract } = await loadCloudRunContract();
  const snapshot = rollbackFixture(contract, "staging");
  assert.equal(validateRollbackSnapshot(snapshot, contract, "staging"), snapshot);
  assert.deepEqual(selectRollbackTraffic({
    metadata: { name: contract.services.api.name },
    status: { traffic: [{ revisionName: "babyloop-api-00001-abc", percent: 100 }] }
  }, contract.services.api.name), [{ revisionName: "babyloop-api-00001-abc", percent: 100 }]);
  const split = [
    { revisionName: "babyloop-api-00002-def", percent: 10 },
    { revisionName: "babyloop-api-00001-abc", percent: 90 }
  ];
  const args = buildTrafficRollbackArgs({
    service: "babyloop-api",
    traffic: split,
    project: "babyloop-staging",
    region: "europe-west1"
  });
  assert.ok(args.includes(
    "--to-revisions=babyloop-api-00002-def=10,babyloop-api-00001-abc=90"
  ));
  assert.equal(exactTrafficMatches([...split].reverse(), split), true);
});

test("rollback traffic validation rejects incomplete and non-restorable traffic contracts", () => {
  for (const [traffic, pattern] of [
    [[{ revisionName: "babyloop-api-00001-abc", percent: 90 }], /total 100/u],
    [[{ revisionName: "", percent: 100 }], /invalid revision/u],
    [[{ revisionName: "babyloop-api-00001-abc", percent: 100, latestRevision: true }], /tag\/latestRevision/u],
    [[{ revisionName: "babyloop-api-00001-abc", percent: 100, tag: "current" }], /tag\/latestRevision/u]
  ]) assert.throws(() => validateRollbackTraffic(traffic), pattern);

  assert.equal(exactTrafficMatches(
    [{ revisionName: "babyloop-api-00001-abc", percent: 90 }, { revisionName: "babyloop-api-00002-def", percent: 10 }],
    [{ revisionName: "babyloop-api-00001-abc", percent: 100 }]
  ), false);
});

test("rollback snapshot supports absent initial bootstrap without inventing a revision", async () => {
  const { contract } = await loadCloudRunContract();
  const directory = await mkdtemp(join(tmpdir(), "babyloop-bootstrap-snapshot-"));
  try {
    const notFound = Object.assign(new Error("NOT_FOUND: service does not exist"), { code: 404 });
    await assert.rejects(captureRollbackSnapshot({
      environment: "production",
      cloudRunContract: contract,
      execute: async () => { throw notFound; },
      outputPath: join(directory, "rejected.json")
    }), /ALLOW_INITIAL_SERVICE_BOOTSTRAP_PRODUCTION/u);

    const captured = await captureRollbackSnapshot({
      environment: "production",
      cloudRunContract: contract,
      bootstrapConfirmation: "ALLOW_INITIAL_SERVICE_BOOTSTRAP_PRODUCTION",
      execute: async () => { throw notFound; },
      outputPath: join(directory, "captured.json")
    });
    assert.equal(captured.snapshot.services.api.state, "absent");
    assert.deepEqual(captured.snapshot.services.api.traffic, []);

    let executeCalls = 0;
    const rollback = await rollbackCloudRunRelease({
      environment: "production",
      cloudRunContract: contract,
      snapshot: captured.snapshot,
      execute: async () => { executeCalls += 1; },
      outputPath: join(directory, "rollback.json")
    });
    assert.equal(executeCalls, 0);
    assert.equal(rollback.evidence.status, "traffic_restored_with_initial_bootstrap_not_restorable");
    assert.ok(rollback.evidence.operations.every(({ status }) => status === "not_restorable_initial_bootstrap"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rollback read-back requires the exact captured distribution", async () => {
  const { contract } = await loadCloudRunContract();
  const snapshot = rollbackFixture(contract, "staging");
  snapshot.services.api.traffic = [
    { revisionName: "babyloop-api-00001-abc", percent: 90 },
    { revisionName: "babyloop-api-00002-def", percent: 10 }
  ];
  const directory = await mkdtemp(join(tmpdir(), "babyloop-exact-rollback-"));
  try {
    const exactExecute = async (args) => {
      if (args.slice(0, 3).join(" ") === "run services describe") {
        const service = args[3];
        const record = Object.values(snapshot.services).find(({ name }) => name === service);
        return { stdout: JSON.stringify({ status: { traffic: record.traffic } }), stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };
    const result = await rollbackCloudRunRelease({
      environment: "staging",
      cloudRunContract: contract,
      snapshot,
      execute: exactExecute,
      outputPath: join(directory, "exact.json")
    });
    assert.equal(result.evidence.readBackVerified, true);

    await assert.rejects(rollbackCloudRunRelease({
      environment: "staging",
      cloudRunContract: contract,
      snapshot,
      execute: async (args) => args.slice(0, 3).join(" ") === "run services describe"
        ? { stdout: JSON.stringify({ status: { traffic: [{ revisionName: args[3] + "-00001-abc", percent: 100 }] } }) }
        : { stdout: "", stderr: "" },
      outputPath: join(directory, "wrong.json")
    }), /Rollback read-back failed/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rollback snapshot rejects blank traffic before any traffic command", async () => {
  const { contract } = await loadCloudRunContract();
  const snapshot = rollbackFixture(contract, "staging");
  assert.throws(() => validateRollbackSnapshot({
    ...snapshot,
    services: { ...snapshot.services, api: { ...snapshot.services.api, traffic: [] } }
  }, contract, "staging"), /is empty/u);
  assert.throws(() => buildTrafficRollbackArgs({
    service: "babyloop-api",
    traffic: [],
    project: "babyloop-staging",
    region: "europe-west1"
  }), /is empty/u);
});

test("backup resolution streams and verifies primary artifact checksum and byte size", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-backup-primary-"));
  try {
    const fixture = await writeBackupFixture(directory, "staging", SHA, "encrypted-backup-bytes");
    const backup = await findBackupManifest(directory, "staging", SHA);
    assert.equal(backup.primaryArtifactChecksum, fixture.sha256);
    assert.equal(backup.primaryArtifactBytes, fixture.bytes);
    assert.equal(backup.primaryManifestChecksum, fixture.manifestChecksum);
    assert.equal(backup.replicaVerified, false);

    await writeFile(fixture.artifactPath, "modified-encrypted-backup", "utf8");
    await assert.rejects(
      findBackupManifest(directory, "staging", SHA),
      /Primary backup artifact checksum/u
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("backup resolution rejects wrong manifest checksum and byte size", async () => {
  const checksumDirectory = await mkdtemp(join(tmpdir(), "babyloop-backup-checksum-"));
  const sizeDirectory = await mkdtemp(join(tmpdir(), "babyloop-backup-size-"));
  try {
    const checksumFixture = await writeBackupFixture(checksumDirectory, "staging", SHA, "artifact");
    await writeFile(checksumFixture.manifestPath, `${JSON.stringify({
      ...checksumFixture.manifest,
      sha256: "f".repeat(64)
    })}\n`, "utf8");
    await assert.rejects(
      findBackupManifest(checksumDirectory, "staging", SHA),
      /artifact checksum/u
    );

    const sizeFixture = await writeBackupFixture(sizeDirectory, "staging", SHA, "artifact");
    await writeFile(sizeFixture.manifestPath, `${JSON.stringify({
      ...sizeFixture.manifest,
      bytes: sizeFixture.bytes + 1
    })}\n`, "utf8");
    await assert.rejects(
      findBackupManifest(sizeDirectory, "staging", SHA),
      /artifact byte size/u
    );
  } finally {
    await Promise.all([
      rm(checksumDirectory, { recursive: true, force: true }),
      rm(sizeDirectory, { recursive: true, force: true })
    ]);
  }
});

test("production backup requires a matching byte-verified replica", async () => {
  const primary = await mkdtemp(join(tmpdir(), "babyloop-backup-production-"));
  const replica = await mkdtemp(join(tmpdir(), "babyloop-backup-replica-"));
  try {
    const fixture = await writeBackupFixture(primary, "production", SHA, "production-encrypted-artifact");
    await writeFile(join(replica, fixture.manifest.artifact + ".manifest.json"), await readFile(fixture.manifestPath));
    await assert.rejects(
      findBackupManifest(primary, "production", SHA, replica),
      /ENOENT/u
    );

    const replicaArtifact = join(replica, fixture.manifest.artifact);
    await writeFile(replicaArtifact, "wrong-replica", "utf8");
    await assert.rejects(
      findBackupManifest(primary, "production", SHA, replica),
      /Replica backup artifact checksum/u
    );

    await writeFile(replicaArtifact, await readFile(fixture.artifactPath));
    const backup = await findBackupManifest(primary, "production", SHA, replica);
    assert.equal(backup.replicaVerified, true);
    assert.equal(backup.primaryArtifactChecksum, backup.replicaArtifactChecksum);
    assert.equal(backup.primaryArtifactBytes, backup.replicaArtifactBytes);
  } finally {
    await Promise.all([
      rm(primary, { recursive: true, force: true }),
      rm(replica, { recursive: true, force: true })
    ]);
  }
});

test("deployment summary treats missing or corrupt optional receipts as non-fatal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "babyloop-release-summary-"));
  try {
    const receiptDirectory = join(directory, ".release/gcp/staging");
    const summaryPath = join(directory, "summary.md");
    await mkdir(receiptDirectory, { recursive: true });
    await writeFile(join(receiptDirectory, "resolved-release-contract.json"), "{corrupt", "utf8");
    await writeFile(join(receiptDirectory, "deployment-metadata.json"), "{corrupt", "utf8");
    const result = spawnSync(process.execPath, [resolve("scripts/deploy/write-release-summary.mjs")], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        DEPLOY_ENVIRONMENT: "staging",
        DEPLOY_JOB_STATUS: "failure",
        GITHUB_STEP_SUMMARY: summaryPath
      }
    });
    assert.equal(result.status, 0, result.stderr);
    const summary = await readFile(summaryPath, "utf8");
    assert.match(summary, /Resolved release contract: `unreadable`/u);
    assert.match(summary, /Smoke\/metadata: `unreadable`/u);
    assert.match(summary, /Public staging acceptance: `not complete`/u);
    assert.doesNotMatch(summary, /corrupt|secret|token/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("workflow metadata, artifact inventory, rollback, and summary consume resolved release artifacts", async () => {
  const [workflow, metadata, smoke] = await Promise.all([
    readFile(".github/workflows/deploy-staging.yml", "utf8"),
    readFile("scripts/deploy/record-release-metadata.mjs", "utf8"),
    readFile("scripts/deploy/post-deploy-smoke.mjs", "utf8")
  ]);
  for (const token of [
    "Staging release rehearsal preflight",
    "Resolve release contract",
    "deploy:release-metadata",
    "deploy:release-rollback",
    "write-release-summary.mjs",
    "if-no-files-found: error"
  ]) assert.match(workflow, new RegExp(token, "u"));
  assert.match(metadata, /validateArtifactInventory\(contract\)/u);
  assert.match(metadata, /contract\.artifacts\.smokeEvidence\.path/u);
  assert.match(smoke, /readJsonReceipt\(releaseContractPath\)/u);
  assert.match(smoke, /public_iam_contract/u);
  assert.match(smoke, /response_body_limit/u);
  assert.doesNotMatch(smoke, /DEPLOY_API_URL|NEXT_PUBLIC_API_BASE_URL/u);
});

function deploymentReceipt(environment, contract) {
  const project = contract?.projects?.[environment] || `babyloop-${environment}`;
  const jobInfrastructure = contract ? Object.fromEntries(
    Object.entries(contract.jobs).filter(([, config]) => config.schedule).map(([key, config]) => [key, {
      scheduler: {
        name: `${config.name}-schedule`,
        state: "ENABLED",
        schedule: config.schedule,
        timeZone: contract.timezone,
        httpMethod: "POST",
        uri: `https://run.googleapis.com/v2/projects/${project}/locations/${contract.region}/jobs/${config.name}:run`,
        oauthServiceAccountEmail: `${contract.serviceAccounts.scheduler}@${project}.iam.gserviceaccount.com`,
        enabledVerified: true,
        scheduleVerified: true,
        timeZoneVerified: true,
        httpMethodVerified: true,
        uriVerified: true,
        oauthServiceAccountVerified: true
      },
      iam: { role: "roles/run.invoker", jobScoped: true, verified: true }
    }])
  ) : {};
  return {
    schemaVersion: 1,
    kind: "gcp_cloud_run_deployment",
    status: "deployed",
    createdAt: "2026-07-26T00:00:00.000Z",
    environment,
    project,
    region: "europe-west1",
    gitSha: SHA,
    phase: "services",
    urls: {
      api: "https://api-deployment.example.test",
      web: "https://web-deployment.example.test",
      backoffice: "https://backoffice-deployment.example.test"
    },
    scheduledInfrastructure: jobInfrastructure
  };
}

function canonicalUrls() {
  return {
    api: "https://api-canonical.example.test",
    web: "https://web-canonical.example.test",
    backoffice: "https://backoffice-canonical.example.test"
  };
}

function imageManifest() {
  return {
    gitSha: SHA,
    images: {
      api: `registry/api@sha256:${"1".repeat(64)}`,
      web: `registry/web@sha256:${"2".repeat(64)}`,
      backoffice: `registry/backoffice@sha256:${"3".repeat(64)}`
    }
  };
}

function migrationReceipt(environment, contract) {
  return {
    status: "completed",
    environment,
    project: contract.projects[environment],
    gitSha: SHA,
    job: contract.jobs.migrate.name
  };
}

function databasePostflight(environment) {
  return {
    status: "passed",
    environment,
    gitSha: SHA,
    migrations: { checkedInHead: "0001_head" }
  };
}

function rollbackFixture(contract, environment) {
  return {
    schemaVersion: 1,
    kind: "gcp_cloud_run_rollback_snapshot",
    status: "captured",
    environment,
    services: Object.fromEntries(Object.entries(contract.services).map(([key, config]) => [key, {
      name: config.name,
      state: "existing",
      traffic: [{ revisionName: `${config.name}-00001-abc`, percent: 100 }],
      rollbackCapability: "exact_traffic_restorable"
    }]))
  };
}

function fakeLiveGcloud(contract, environment) {
  const project = contract.projects[environment];
  const schedulerEmail = `${contract.serviceAccounts.scheduler}@${project}.iam.gserviceaccount.com`;
  return async (args) => {
    const path = args.slice(0, 3).join(" ");
    if (args.includes("--help")) {
      return {
        stdout: "--headers --update-headers --allow-unauthenticated --task-timeout --member --to-revisions\n",
        stderr: ""
      };
    }
    if (path.startsWith("auth list")) return { stdout: "deployer@example.test\n", stderr: "" };
    if (path.startsWith("config get-value")) return { stdout: `${project}\n`, stderr: "" };
    if (path.startsWith("services list")) return { stdout: `${contract.requiredApis.join("\n")}\n`, stderr: "" };
    if (path === "run services describe") {
      const service = args[3];
      return {
        stdout: JSON.stringify({
          metadata: { name: service },
          status: {
            url: `https://${service}.example.test`,
            traffic: [{ revisionName: `${service}-00001-abc`, percent: 100 }]
          }
        }),
        stderr: ""
      };
    }
    if (path === "run jobs get-iam-policy") {
      return {
        stdout: JSON.stringify({
          bindings: [{ role: "roles/run.invoker", members: [`serviceAccount:${schedulerEmail}`] }]
        }),
        stderr: ""
      };
    }
    if (path === "scheduler jobs describe") {
      const schedulerName = args[3];
      const config = Object.values(contract.jobs).find((value) => `${value.name}-schedule` === schedulerName);
      return {
        stdout: JSON.stringify({
          state: "ENABLED",
          schedule: config.schedule,
          timeZone: contract.timezone,
          httpTarget: {
            httpMethod: "POST",
            uri: `https://run.googleapis.com/v2/projects/${project}/locations/${contract.region}/jobs/${config.name}:run`,
            oauthToken: { serviceAccountEmail: schedulerEmail }
          }
        }),
        stderr: ""
      };
    }
    return { stdout: "{}\n", stderr: "" };
  };
}

async function writeBackupFixture(directory, environment, gitSha, content) {
  await mkdir(directory, { recursive: true });
  const artifact = `babyloop-${environment}.dump.age`;
  const artifactPath = join(directory, artifact);
  const bytes = Buffer.byteLength(content);
  const sha256 = createHash("sha256").update(content).digest("hex");
  const manifest = {
    environment,
    gitSha,
    encrypted: true,
    artifact,
    bytes,
    sha256
  };
  const source = `${JSON.stringify(manifest)}\n`;
  const manifestPath = `${artifactPath}.manifest.json`;
  await writeFile(artifactPath, content, "utf8");
  await writeFile(manifestPath, source, "utf8");
  return {
    artifactPath,
    bytes,
    manifest,
    manifestChecksum: createHash("sha256").update(source).digest("hex"),
    manifestPath,
    sha256
  };
}

import { existsSync, readFileSync } from "node:fs";

const problems = [];
const requiredFiles = [
  "scripts/deploy/release-evidence-lib.mjs",
  "scripts/deploy/post-deploy-smoke.mjs",
  "scripts/deploy/sign-manual-evidence.mjs",
  "scripts/deploy/verify-release-evidence.mjs",
  "scripts/deploy/release-go-no-go.mjs",
  "scripts/deploy/test/release-evidence-lib.test.mjs",
  "scripts/deploy/test/release-go-no-go.test.mjs",
  "deploy/evidence/mobile-release-evidence.example.json",
  "deploy/evidence/provider-release-evidence.example.json",
  "deploy/evidence/container-image-manifest.example.json",
  "deploy/evidence/runtime-env-audit.example.json",
  "deploy/evidence/staging-bootstrap-plan.example.json",
  "deploy/evidence/provider-probe-evidence.example.json",
  "scripts/deploy/assemble-image-manifest.mjs",
  "scripts/deploy/runtime-env-lib.mjs",
  "scripts/deploy/audit-runtime-env.mjs",
  "scripts/deploy/check-runtime-env-readiness.mjs",
  "scripts/deploy/create-staging-bootstrap-plan.mjs",
  "scripts/deploy/provider-probe.mjs",
  "scripts/check-deployment-command-safety.mjs",
  "scripts/release-candidate-preflight.sh",
  "docs/89-release-candidate-acceptance-go-no-go.md"
];
for (const file of requiredFiles) if (!existsSync(file)) problems.push(`Missing release candidate file: ${file}`);

function read(file) { return readFileSync(file, "utf8"); }
function must(file, token) {
  if (!read(file).includes(token)) problems.push(`${file} must contain ${JSON.stringify(token)}.`);
}
function mustNot(file, token) {
  if (read(file).includes(token)) problems.push(`${file} must not contain ${JSON.stringify(token)}.`);
}
function mustAppearInOrder(file, tokens) {
  const source = read(file);
  let cursor = -1;
  for (const token of tokens) {
    const index = source.indexOf(token, cursor + 1);
    if (index < 0) {
      problems.push(`${file} must contain ${JSON.stringify(token)} in order.`);
      return;
    }
    cursor = index;
  }
}

if (problems.length === 0) {
  for (const token of [
    "deployment_acceptance",
    "/api/v1/categories",
    "imageLimit=1",
    "/legal/kvkk",
    "/support/contact",
    "content-security-policy",
    "DEPLOY_ACCEPTANCE_MAX_P95_MS",
    "DEPLOY_ACCEPTANCE_MAX_HTML_BYTES",
    "DEPLOY_ACCEPTANCE_MAX_JSON_BYTES",
    "writeJsonReceipt"
  ]) must("scripts/deploy/post-deploy-smoke.mjs", token);

  for (const token of [
    "GO_NO_GO_RUNTIME_ENV_AUDIT_PATH",
    "GO_NO_GO_BOOTSTRAP_PLAN_PATH",
    "GO_NO_GO_PROVIDER_PROBE_PATH",
    "GO_NO_GO_STAGING_ACCEPTANCE_PATH",
    "GO_NO_GO_RESTORE_SMOKE_PATH",
    "GO_NO_GO_MOBILE_EVIDENCE_PATH",
    "GO_NO_GO_PROVIDER_EVIDENCE_PATH",
    "production_go_no_go",
    'decision: "GO"'
  ]) must("scripts/deploy/release-go-no-go.mjs", token);

  for (const token of [
    "PRODUCTION_GO_NO_GO_RECEIPT_PATH",
    "verify-release-evidence.mjs",
    "DEPLOY_RELEASE_MANIFEST_PATH"
  ]) must("scripts/deploy/promote-release.mjs", token);
  mustAppearInOrder("scripts/deploy/promote-release.mjs", [
    "verify-release-evidence.mjs",
    "postgres-backup.mjs",
    "check-deployment-readiness.mjs",
    "release-manifest.mjs",
    '"--profile", "release"',
    '"up", "-d"',
    "post-deploy-smoke.mjs",
    "writeJsonReceipt"
  ]);

  for (const token of [
    'kind: "restore_smoke"',
    "RESTORE_SMOKE_EVIDENCE_PATH",
    "writeJsonReceipt"
  ]) must("scripts/ops/postgres-restore-smoke.mjs", token);

  for (const file of ["deploy/env/staging.env.example", "deploy/env/production.env.example"]) {
    for (const token of [
      "DEPLOY_ACCEPTANCE_SAMPLES=",
      "DEPLOY_ACCEPTANCE_MAX_P95_MS=",
      "DEPLOY_ACCEPTANCE_MAX_HTML_BYTES=",
      "DEPLOY_ACCEPTANCE_MAX_JSON_BYTES=",
      "DEPLOY_ACCEPTANCE_EVIDENCE_PATH=",
      "GO_NO_GO_MAX_AGE_HOURS=",
      "RUNTIME_ENV_AUDIT_EVIDENCE_PATH=",
      "PROVIDER_PROBE_EVIDENCE_PATH="
    ]) must(file, token);
  }
  must("deploy/env/production.env.example", "DEPLOY_ACCEPTANCE_ENFORCE_PERFORMANCE=true");
  must("deploy/env/production.env.example", "PRODUCTION_GO_NO_GO_RECEIPT_PATH=");
  must("deploy/env/staging.env.example", "STAGING_BOOTSTRAP_PLAN_PATH=");
  for (const token of [
    "GO_NO_GO_RUNTIME_ENV_AUDIT_PATH=",
    "GO_NO_GO_BOOTSTRAP_PLAN_PATH=",
    "GO_NO_GO_PROVIDER_PROBE_PATH="
  ]) must("deploy/env/production.env.example", token);

  const packageData = JSON.parse(read("package.json"));
  for (const name of [
    "deploy:acceptance",
    "deploy:evidence:sign",
    "deploy:evidence:verify",
    "release:go-no-go",
    "test:release-evidence",
    "security:release-candidate-acceptance",
    "release:candidate:preflight",
    "deploy:images:manifest",
    "deploy:runtime-env:audit",
    "deploy:runtime-env:readiness",
    "deploy:staging:plan",
    "deploy:providers:probe",
    "security:staging-bootstrap"
  ]) {
    if (!packageData.scripts?.[name]) problems.push(`package.json is missing ${name}.`);
  }
  if (!(packageData.scripts?.["test:api:security"] || "").includes("security:release-candidate-acceptance")) {
    problems.push("test:api:security must include security:release-candidate-acceptance.");
  }

  must(".github/workflows/ci.yml", "workflow_dispatch:");
  must("scripts/check-manual-workflow-triggers.mjs", "workflow_dispatch");
  must("scripts/check-manual-workflow-triggers.mjs", "unsupported trigger(s)");
  must("scripts/check-deployment-command-safety.mjs", "shell execution with shell: true");

  for (const file of [
    "scripts/deploy/release-evidence-lib.mjs",
    "scripts/deploy/post-deploy-smoke.mjs",
    "scripts/deploy/sign-manual-evidence.mjs",
    "scripts/deploy/verify-release-evidence.mjs",
    "scripts/deploy/release-go-no-go.mjs",
    "scripts/deploy/assemble-image-manifest.mjs",
    "scripts/deploy/runtime-env-lib.mjs",
    "scripts/deploy/audit-runtime-env.mjs",
    "scripts/deploy/create-staging-bootstrap-plan.mjs",
    "scripts/deploy/provider-probe.mjs"
  ]) mustNot(file, "shell: true");
}

if (problems.length > 0) {
  console.error("Release candidate acceptance boundary failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log("Release candidate acceptance and GO/NO-GO boundary passed.");

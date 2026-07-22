#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const problems = [];
const required = [
  "deploy/gcp/cloud-run.contract.json",
  "deploy/gcp/README.md",
  "scripts/gcp/cloud-run-lib.mjs",
  "scripts/gcp/plan-cloud-run.mjs",
  "scripts/gcp/bootstrap-cloud-run.mjs",
  "scripts/gcp/import-runtime-env.mjs",
  "scripts/gcp/build-cloud-run-images.mjs",
  "scripts/gcp/deploy-cloud-run.mjs",
  "scripts/gcp/execute-cloud-run-migration.mjs",
  "scripts/gcp/map-cloud-run-domains.mjs",
  "scripts/gcp/cloud-run-iam-lib.mjs",
  "scripts/gcp/audit-cloud-run-iam.mjs",
  "scripts/gcp/repair-cloud-run-iam.mjs",
  "scripts/gcp/test/cloud-run-iam.test.mjs",
  "scripts/gcp/test/cloud-run-lib.test.mjs",
  "scripts/gcp/test/cloud-run-contract.test.mjs",
  "docs/93-gcp-cloud-run-deployment.md"
];
for (const file of required) if (!existsSync(file)) problems.push(`Missing GCP Cloud Run file: ${file}`);
const read = (file) => readFileSync(file, "utf8");
const must = (file, token) => { if (!read(file).includes(token)) problems.push(`${file} must contain ${JSON.stringify(token)}.`); };
const mustNot = (file, token) => { if (read(file).includes(token)) problems.push(`${file} must not contain ${JSON.stringify(token)}.`); };

if (problems.length === 0) {
  const contract = JSON.parse(read("deploy/gcp/cloud-run.contract.json"));
  if (contract.projects.staging !== "babyloop-staging") problems.push("Staging project ID must be babyloop-staging.");
  if (contract.projects.production !== "babyloop-production") problems.push("Production project ID must be babyloop-production.");
  if (contract.region !== "europe-west1") problems.push("Cloud Run region must remain europe-west1.");
  for (const [name, service] of Object.entries(contract.services)) {
    if (service.minInstances !== 0) problems.push(`${name} must scale to zero.`);
    if (service.maxInstances !== 1) problems.push(`${name} must be capped at one instance for initial release.`);
  }
  if (contract.jobs.migrate.schedule) problems.push("Migration job must never be scheduled.");
  if (contract.jobs.notification.schedule !== "*/5 * * * *") problems.push("Notification job must use the cost-bounded five-minute schedule.");
  if (contract.jobs.childReminder.schedule !== "*/5 * * * *") problems.push("Reminder job must use the cost-bounded five-minute schedule.");

  for (const [file, tokens] of Object.entries({
    "scripts/gcp/bootstrap-cloud-run.mjs": ["GCP_BOOTSTRAP_CONFIRM", "remove-iam-policy-binding", "repository-format=docker"],
    "scripts/gcp/import-runtime-env.mjs": ["assertConfirmation(\"secret-import\"", "secretAccessor", "--data-file=-", "secretBindings"],
    "scripts/gcp/build-cloud-run-images.mjs": ["linux/amd64", "containerimage.digest", "--sbom=true", "assertConfirmation(\"build\""],
    "scripts/gcp/deploy-cloud-run.mjs": ["--min-instances=", "--max-instances=", "--set-secrets=", "migrationExecuted: false", "assertConfirmation(\"deploy\"", "jobs", "add-iam-policy-binding"],
    "scripts/gcp/execute-cloud-run-migration.mjs": ["GCP_MIGRATION_CONFIRM", "--wait"],
    "scripts/gcp/map-cloud-run-domains.mjs": ["assertConfirmation(\"domain-map\"", "list-user-verified", "domain-mappings"]
  })) for (const token of tokens) must(file, token);

  mustNot(
    "scripts/gcp/bootstrap-cloud-run.mjs",
    '"projects", "add-iam-policy-binding"'
  );
  must(
    "scripts/gcp/deploy-cloud-run.mjs",
    "grantSchedulerJobInvocation"
  );
  must(
    "scripts/gcp/repair-cloud-run-iam.mjs",
    'assertConfirmation("iam-repair"'
  );
  must(
    "scripts/gcp/audit-cloud-run-iam.mjs",
    "projectWideInvoker"
  );

  for (const file of required.filter((file) => file.endsWith(".mjs"))) {
    mustNot(file, "shell: true");
    mustNot(file, "service-accounts keys create");
  }
  for (const file of [
    "scripts/gcp/bootstrap-cloud-run.mjs",
    "scripts/gcp/import-runtime-env.mjs",
    "scripts/gcp/build-cloud-run-images.mjs",
    "scripts/gcp/deploy-cloud-run.mjs",
    "scripts/gcp/execute-cloud-run-migration.mjs",
    "scripts/gcp/map-cloud-run-domains.mjs"
  ]) mustNot(file, ":latest");

  const scripts = JSON.parse(read("package.json")).scripts || {};
  for (const name of [
    "gcp:cloud-run:plan", "gcp:cloud-run:bootstrap", "gcp:cloud-run:secrets",
    "gcp:cloud-run:build", "gcp:cloud-run:deploy", "gcp:cloud-run:migrate",
    "gcp:cloud-run:domains", "gcp:cloud-run:iam:audit",
    "gcp:cloud-run:iam:repair", "test:gcp:cloud-run",
    "security:gcp-cloud-run"
  ]) if (!scripts[name]) problems.push(`package.json is missing ${name}.`);
}

if (problems.length) {
  console.error("GCP Cloud Run deployment boundary failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log("GCP Cloud Run deployment boundary passed.");

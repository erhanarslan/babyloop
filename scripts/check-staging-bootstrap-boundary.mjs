#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const errors = [];
const requiredFiles = [
  "deploy/env/runtime-env.contract.json",
  "deploy/env/staging.release.env.example",
  "deploy/evidence/container-image-manifest.example.json",
  "deploy/evidence/runtime-env-audit.example.json",
  "deploy/evidence/staging-bootstrap-plan.example.json",
  "deploy/evidence/provider-probe-evidence.example.json",
  "scripts/deploy/assemble-image-manifest.mjs",
  "scripts/deploy/runtime-env-lib.mjs",
  "scripts/deploy/audit-runtime-env.mjs",
  "scripts/deploy/check-runtime-env-readiness.mjs",
  "scripts/deploy/create-staging-bootstrap-plan.mjs",
  "scripts/deploy/execute-staging-deploy.mjs",
  "scripts/deploy/provider-probe.mjs",
  "scripts/deploy/render-compose-plan.mjs",
  "scripts/check-manual-workflow-triggers.mjs",
  "scripts/check-deployment-command-safety.mjs",
  "scripts/deploy/staging-bootstrap.sh",
  "docs/90-staging-bootstrap-provider-readiness.md",
  "docs/91-domain-dns-tls-cutover-runbook.md",
  "docs/92-staging-acceptance-execution-checklist.md"
];
for (const file of requiredFiles) if (!existsSync(file)) errors.push(`Missing ${file}`);

const packageJson = safeRead("package.json");
for (const token of [
  "deploy:compose:plan",
  "deploy:images:manifest",
  "deploy:runtime-env:audit",
  "deploy:runtime-env:readiness",
  "deploy:staging:plan",
  "deploy:staging:prepare",
  "deploy:staging:execute",
  "deploy:providers:plan",
  "deploy:providers:probe",
  "security:staging-bootstrap",
  "security:manual-workflows",
  "security:deployment-command-safety"
]) mustContain("package.json", packageJson, token);

const compose = safeRead("deploy/compose/docker-compose.runtime.yml");
for (const token of [
  "API_BIND_ADDRESS",
  "WEB_BIND_ADDRESS",
  "BACKOFFICE_BIND_ADDRESS",
  "pids_limit:",
  "no-new-privileges:true",
  "max-size: \"10m\""
]) mustContain("deploy/compose/docker-compose.runtime.yml", compose, token);

const caddy = safeRead("deploy/proxy/Caddyfile.example");
for (const token of [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Robots-Tag",
  "output stdout"
]) mustContain("deploy/proxy/Caddyfile.example", caddy, token);

for (const file of [
  ".github/workflows/ci.yml",
  ".github/workflows/container-images.yml",
  ".github/workflows/release-e2e.yml"
]) {
  mustContain(file, safeRead(file), "workflow_dispatch:");
}
mustContain(
  "scripts/check-manual-workflow-triggers.mjs",
  safeRead("scripts/check-manual-workflow-triggers.mjs"),
  "disallowed top-level trigger(s)"
);

if (errors.length > 0) {
  console.error("Staging bootstrap boundary failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Staging bootstrap, provider readiness and cutover boundary passed.");

function safeRead(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
function mustContain(path, content, token) {
  if (!content.includes(token)) errors.push(`${path} must contain ${JSON.stringify(token)}.`);
}

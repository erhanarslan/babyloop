#!/usr/bin/env node
import { resolve } from "node:path";
import {
  artifactRoot,
  assertConfirmation,
  assertEnvironment,
  assertGcloudContext,
  gcloud,
  loadCloudRunContract,
  parseFlag,
  safeMessage,
  writeJson
} from "./cloud-run-lib.mjs";

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const baseDomain = String(parseFlag("base-domain") || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/u.test(baseDomain)) throw new Error("--base-domain must be a valid domain.");
  const { contract } = await loadCloudRunContract();
  assertConfirmation("domain-map", environment);
  const context = await assertGcloudContext(contract, environment);
  const domains = environment === "production"
    ? { web: baseDomain, api: `api.${baseDomain}`, backoffice: `admin.${baseDomain}` }
    : { web: `staging.${baseDomain}`, api: `api.staging.${baseDomain}`, backoffice: `admin.staging.${baseDomain}` };
  const verified = await gcloud(["domains", "list-user-verified", "--format=value(id)"], { capture: true });
  if (!verified.stdout.split(/\r?\n/u).map((value) => value.trim()).includes(baseDomain)) {
    throw new Error(`${baseDomain} is not verified for the active Google account. Run: gcloud domains verify ${baseDomain}`);
  }
  const records = {};
  for (const [key, domain] of Object.entries(domains)) {
    const service = contract.services[key].name;
    try {
      await gcloud(["beta", "run", "domain-mappings", "create", `--service=${service}`, `--domain=${domain}`, `--region=${contract.region}`, `--project=${context.project}`]);
    } catch (error) {
      if (!String(error).includes("already exists")) throw error;
    }
    const described = await gcloud(["beta", "run", "domain-mappings", "describe", `--domain=${domain}`, `--region=${contract.region}`, `--project=${context.project}`, "--format=json"], { capture: true });
    const value = JSON.parse(described.stdout);
    records[key] = { domain, service, resourceRecords: value.status?.resourceRecords || [] };
  }
  const receipt = await writeJson(resolve(artifactRoot(contract, environment), "cloud-run-domain-mappings.json"), {
    schemaVersion: 1,
    kind: "gcp_cloud_run_domain_mappings",
    createdAt: new Date().toISOString(),
    environment,
    project: context.project,
    region: contract.region,
    baseDomain,
    mappings: records,
    warning: "Cloud Run domain mapping is Preview; add every returned DNS record at the domain registrar and retain run.app for Scheduler/smoke."
  });
  console.log(JSON.stringify({ ok: true, environment, project: context.project, mappings: records, receipt: receipt.path }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
  process.exitCode = 1;
});

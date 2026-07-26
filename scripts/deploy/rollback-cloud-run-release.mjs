#!/usr/bin/env node
import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  artifactRoot,
  assertEnvironment,
  gcloud,
  loadCloudRunContract,
  parseFlag,
  safeMessage
} from "../gcp/cloud-run-lib.mjs";
import { readJsonReceipt, writeJsonReceipt } from "./deployment-lib.mjs";
import {
  buildTrafficRollbackArgs,
  exactTrafficMatches,
  validateRollbackSnapshot
} from "./release-orchestration-lib.mjs";
import { buildRollbackRevisionDescribeArgs } from "./capture-cloud-run-rollback.mjs";

export async function rollbackCloudRunRelease({
  environment,
  cloudRunContract,
  snapshot,
  execute = gcloud,
  dryRun = false,
  outputPath
}) {
  validateRollbackSnapshot(snapshot, cloudRunContract, environment);
  const project = cloudRunContract.projects[environment];
  const operations = [];
  for (const [key, record] of Object.entries(snapshot.services)) {
    if (record.state === "absent") {
      operations.push({
        key,
        service: record.name,
        state: "absent",
        status: "not_restorable_initial_bootstrap",
        traffic: []
      });
      continue;
    }
    const args = buildTrafficRollbackArgs({
      service: record.name,
      traffic: record.traffic,
      project,
      region: cloudRunContract.region
    });
    operations.push({
      key,
      service: record.name,
      state: "existing",
      status: "traffic_restore_planned",
      traffic: record.traffic,
      args
    });
    if (!dryRun) await execute(args);
  }
  if (!dryRun) {
    for (const operation of operations.filter(({ state }) => state === "existing")) {
      const result = await execute(buildRollbackRevisionDescribeArgs({
        service: operation.service,
        project,
        region: cloudRunContract.region
      }), { capture: true });
      const description = JSON.parse(result.stdout || "null");
      if (!exactTrafficMatches(description?.status?.traffic, operation.traffic)) {
        throw new Error(`Rollback read-back failed for Cloud Run service ${operation.service}.`);
      }
      operation.status = "traffic_restored_exactly";
    }
  }
  const hasAbsentServices = operations.some(({ state }) => state === "absent");
  const evidence = {
    schemaVersion: 1,
    kind: "gcp_cloud_run_rollback",
    status: dryRun
      ? "planned"
      : hasAbsentServices
        ? "traffic_restored_with_initial_bootstrap_not_restorable"
        : "traffic_restored",
    createdAt: new Date().toISOString(),
    environment,
    project,
    region: cloudRunContract.region,
    operations: operations.map(({ key, service, state, status, traffic }) => ({
      key,
      service,
      state,
      status,
      traffic
    })),
    databaseSchemaRolledBack: false,
    readBackVerified: !dryRun && operations
      .filter(({ state }) => state === "existing")
      .every(({ status }) => status === "traffic_restored_exactly")
  };
  const receipt = await writeJsonReceipt(outputPath, evidence);
  return { evidence, receipt };
}

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const { contract } = await loadCloudRunContract();
  const root = artifactRoot(contract, environment);
  const markerPath = resolve(root, "services-mutation-started");
  await access(markerPath);
  const releaseContractPath = resolve(root, "resolved-release-contract.json");
  const resolvedContract = await readJsonReceipt(releaseContractPath, { optional: true });
  const snapshotReference = resolvedContract?.rollback?.snapshot || {
    path: resolve(root, "cloud-run-rollback-snapshot.json"),
    checksum: null
  };
  if (snapshotReference.checksum) {
    const sidecarChecksum = (await readFile(`${snapshotReference.path}.sha256`, "utf8")).trim().split(/\s+/u)[0];
    if (sidecarChecksum !== snapshotReference.checksum) {
      throw new Error("Rollback snapshot checksum does not match the resolved release contract.");
    }
  }
  const snapshot = await readJsonReceipt(snapshotReference.path);
  const result = await rollbackCloudRunRelease({
    environment,
    cloudRunContract: contract,
    snapshot,
    dryRun: parseFlag("dry-run") === "true",
    outputPath: resolve(root, "cloud-run-rollback.json")
  });
  await writeFile(
    resolve(root, "database-forward-fix-required.txt"),
    "Database schema was not rolled back; use a forward fix or an approved verified restore.\n",
    { mode: 0o600 }
  );
  process.stdout.write(`${JSON.stringify({
    ok: true,
    environment,
    status: result.evidence.status,
    receipt: result.receipt.path,
    checksum: result.receipt.checksum
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: safeMessage(error) })}\n`);
    process.exitCode = 1;
  });
}

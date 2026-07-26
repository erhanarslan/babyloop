#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  artifactRoot,
  assertEnvironment,
  gcloud,
  isGcloudNotFoundError,
  loadCloudRunContract,
  parseFlag,
  safeMessage
} from "../gcp/cloud-run-lib.mjs";
import { writeJsonReceipt } from "./deployment-lib.mjs";
import {
  initialServiceBootstrapPolicy,
  validateRollbackTraffic
} from "./release-orchestration-lib.mjs";

export function buildRollbackRevisionDescribeArgs({ service, project, region }) {
  return [
    "run", "services", "describe", service,
    `--project=${project}`,
    `--region=${region}`,
    "--format=json(metadata.name,status.traffic)"
  ];
}

export function selectRollbackTraffic(description, expectedService) {
  const actualName = String(description?.metadata?.name || "").split("/").at(-1);
  if (actualName !== expectedService) throw new Error(`Cloud Run service ${expectedService} describe returned an unexpected resource.`);
  return validateRollbackTraffic(
    description?.status?.traffic,
    `Cloud Run service ${expectedService} rollback traffic`
  );
}

export async function captureRollbackSnapshot({
  environment,
  cloudRunContract,
  execute = gcloud,
  bootstrapConfirmation = process.env.GCP_INITIAL_SERVICE_BOOTSTRAP_CONFIRM,
  outputPath
}) {
  const project = cloudRunContract.projects[environment];
  const services = {};
  const bootstrapPolicy = initialServiceBootstrapPolicy(
    environment,
    bootstrapConfirmation
  );
  for (const [key, config] of Object.entries(cloudRunContract.services)) {
    let result;
    try {
      result = await execute(buildRollbackRevisionDescribeArgs({
        service: config.name,
        project,
        region: cloudRunContract.region
      }), { capture: true });
    } catch (error) {
      if (!isGcloudNotFoundError(error)) throw error;
      if (!bootstrapPolicy.allowed) {
        throw new Error(
          `Cloud Run service ${config.name} is absent; GCP_INITIAL_SERVICE_BOOTSTRAP_CONFIRM=${bootstrapPolicy.expectedConfirmation} is required.`,
          { cause: error }
        );
      }
      services[key] = {
        name: config.name,
        state: "absent",
        traffic: [],
        rollbackCapability: "not_restorable_initial_bootstrap"
      };
      continue;
    }
    let description;
    try {
      description = JSON.parse(result.stdout || "null");
    } catch (error) {
      throw new Error(`Cloud Run service ${config.name} rollback describe returned malformed JSON.`, { cause: error });
    }
    services[key] = {
      name: config.name,
      state: "existing",
      traffic: selectRollbackTraffic(description, config.name),
      rollbackCapability: "exact_traffic_restorable"
    };
  }
  const snapshot = {
    schemaVersion: 1,
    kind: "gcp_cloud_run_rollback_snapshot",
    status: "captured",
    createdAt: new Date().toISOString(),
    environment,
    project,
    region: cloudRunContract.region,
    initialServiceBootstrapPolicy: bootstrapPolicy,
    services
  };
  const receipt = await writeJsonReceipt(outputPath, snapshot);
  return { receipt, snapshot };
}

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const { contract } = await loadCloudRunContract();
  const outputPath = resolve(
    parseFlag("output")
      || artifactRoot(contract, environment),
    parseFlag("output") ? "" : "cloud-run-rollback-snapshot.json"
  );
  const result = await captureRollbackSnapshot({ environment, cloudRunContract: contract, outputPath });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    environment,
    outputPath: result.receipt.path,
    checksum: result.receipt.checksum,
    services: Object.keys(result.snapshot.services)
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: safeMessage(error) })}\n`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
import { resolve } from "node:path";
import {
  artifactRoot,
  assertDigestImage,
  assertEnvironment,
  assertFullGitSha,
  assertGcloudContext,
  gcloud,
  loadCloudRunContract,
  parseFlag,
  safeMessage,
  writeJson
} from "./cloud-run-lib.mjs";

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  if (environment !== "production") throw new Error("Image promotion target must be production.");
  if (process.env.GCP_PROMOTE_CONFIRM !== "PROMOTE_STAGING_TO_PRODUCTION") {
    throw new Error("GCP_PROMOTE_CONFIRM must equal PROMOTE_STAGING_TO_PRODUCTION.");
  }
  const sourceEnvironment = assertEnvironment(parseFlag("source-environment") || "staging");
  const gitSha = assertFullGitSha(parseFlag("git-sha"));
  const { contract, sha256 } = await loadCloudRunContract();
  const context = await assertGcloudContext(contract, environment);
  const sourceProject = contract.projects[sourceEnvironment];
  if (sourceProject === context.project) throw new Error("Source and target projects must differ.");

  const repository = `${contract.region}-docker.pkg.dev/${sourceProject}/${contract.repository}`;
  const images = {};
  for (const target of ["api", "web", "backoffice"]) {
    const taggedImage = `${repository}/babyloop-${target}:${gitSha}`;
    const result = await gcloud([
      "artifacts", "docker", "images", "describe", taggedImage,
      `--project=${sourceProject}`,
      "--format=value(image_summary.digest)"
    ], { capture: true });
    const digest = result.stdout.trim();
    images[target] = assertDigestImage(
      `${repository}/babyloop-${target}@${digest}`,
      `${target} promoted image`
    );
  }

  const manifest = await writeJson(resolve(artifactRoot(contract, environment), "cloud-run-image-manifest.json"), {
    schemaVersion: 1,
    kind: "gcp_cloud_run_image_manifest",
    createdAt: new Date().toISOString(),
    environment,
    sourceEnvironment,
    sourceProject,
    project: context.project,
    region: contract.region,
    gitSha,
    contractSha256: sha256,
    platform: "linux/amd64",
    images,
    promotion: {
      rebuilt: false,
      sourceTag: gitSha,
      digestPreserved: true
    }
  });
  console.log(JSON.stringify({ ok: true, environment, sourceEnvironment, gitSha, manifest: manifest.path, images }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
  process.exitCode = 1;
});

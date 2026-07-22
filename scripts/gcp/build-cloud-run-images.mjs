#!/usr/bin/env node
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFile } from "../deploy/deployment-lib.mjs";
import {
  artifactRoot,
  assertConfirmation,
  assertEnvironment,
  assertFullGitSha,
  assertGcloudContext,
  gcloud,
  loadCloudRunContract,
  parseFlag,
  run,
  safeMessage,
  writeJson
} from "./cloud-run-lib.mjs";

const PUBLIC_BUILD_KEYS = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_BACKOFFICE_BASE_URL",
  "NEXT_PUBLIC_LEGAL_OPERATOR_NAME",
  "NEXT_PUBLIC_LEGAL_CONTACT_EMAIL",
  "NEXT_PUBLIC_LEGAL_RELEASE_MODE",
  "NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED",
  "NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION"
];

async function main() {
  const environment = assertEnvironment(parseFlag("environment"));
  const envFile = parseFlag("env-file");
  if (!envFile) throw new Error("--env-file is required.");
  const { contract, sha256 } = await loadCloudRunContract();
  assertConfirmation("build", environment);
  const context = await assertGcloudContext(contract, environment);
  const { values } = await loadEnvFile(envFile);
  for (const key of PUBLIC_BUILD_KEYS) if (!String(values[key] || "").trim()) throw new Error(`${key} is required for image build.`);
  const gitResult = await run("git", ["rev-parse", "HEAD"], { capture: true });
  const gitSha = assertFullGitSha(gitResult.stdout.trim());
  const registry = `${contract.region}-docker.pkg.dev`;
  const repository = `${registry}/${context.project}/${contract.repository}`;
  await gcloud(["auth", "configure-docker", registry]);
  const root = artifactRoot(contract, environment);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const images = {};

  for (const target of ["api", "web", "backoffice"]) {
    const tag = `${repository}/babyloop-${target}:${gitSha}`;
    const metadataPath = resolve(root, `${target}-build-metadata.json`);
    const args = [
      "buildx", "build", ".",
      "--file=deploy/docker/Dockerfile",
      `--target=${target}`,
      "--platform=linux/amd64",
      `--tag=${tag}`,
      "--push",
      `--metadata-file=${metadataPath}`,
      "--provenance=mode=min",
      "--sbom=true"
    ];
    if (target !== "api") {
      args.push(`--build-arg=NEXT_PUBLIC_API_BASE_URL=${values.NEXT_PUBLIC_API_BASE_URL}`);
      if (target === "web") {
        args.push(`--build-arg=NEXT_PUBLIC_SITE_URL=${values.NEXT_PUBLIC_SITE_URL}`);
        args.push(`--build-arg=NEXT_PUBLIC_BACKOFFICE_BASE_URL=${values.NEXT_PUBLIC_BACKOFFICE_BASE_URL}`);
        args.push(`--build-arg=NEXT_PUBLIC_LEGAL_OPERATOR_NAME=${values.NEXT_PUBLIC_LEGAL_OPERATOR_NAME}`);
        args.push(`--build-arg=NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=${values.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL}`);
        args.push(`--build-arg=NEXT_PUBLIC_LEGAL_RELEASE_MODE=${values.NEXT_PUBLIC_LEGAL_RELEASE_MODE}`);
        args.push(`--build-arg=NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED=${values.NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED}`);
        args.push(`--build-arg=NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION=${values.NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION}`);
        args.push(`--build-arg=NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS=${values.NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS || ""}`);
      }
    }
    await run("docker", args);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    const digest = metadata["containerimage.digest"];
    if (!/^sha256:[a-f0-9]{64}$/u.test(String(digest || ""))) throw new Error(`Docker did not return a valid digest for ${target}.`);
    images[target] = `${repository}/babyloop-${target}@${digest}`;
    await rm(metadataPath, { force: true });
  }

  const manifest = await writeJson(resolve(root, "cloud-run-image-manifest.json"), {
    schemaVersion: 1,
    kind: "gcp_cloud_run_image_manifest",
    createdAt: new Date().toISOString(),
    environment,
    project: context.project,
    region: contract.region,
    gitSha,
    contractSha256: sha256,
    platform: "linux/amd64",
    images,
    attestations: { provenance: "mode=min", sbom: true }
  });
  console.log(JSON.stringify({ ok: true, environment, project: context.project, gitSha, manifest: manifest.path, images }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeMessage(error) }));
  process.exitCode = 1;
});

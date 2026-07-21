#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertDigestImage,
  assertEnvironment,
  required,
  timestampForFile,
  writeJsonReceipt
} from "./deployment-lib.mjs";
import { RELEASE_EVIDENCE_SCHEMA_VERSION } from "./release-evidence-lib.mjs";

const inputDir = resolve(readArg("--input-dir") || required(process.env.IMAGE_MANIFEST_INPUT_DIR, "IMAGE_MANIFEST_INPUT_DIR"));
const environment = assertEnvironment(readArg("--environment") || process.env.IMAGE_MANIFEST_ENVIRONMENT);
const gitSha = readArg("--git-sha") || required(process.env.IMAGE_MANIFEST_GIT_SHA, "IMAGE_MANIFEST_GIT_SHA");
if (!/^[a-f0-9]{40}$/u.test(gitSha)) throw new Error("IMAGE_MANIFEST_GIT_SHA must be a full lowercase SHA.");

const entries = {};
for (const fileName of await readdir(inputDir)) {
  if (!fileName.endsWith(".json")) continue;
  const value = JSON.parse(await readFile(resolve(inputDir, fileName), "utf8"));
  const target = String(value.target || "").trim();
  if (!["api", "web", "backoffice"].includes(target)) continue;
  if (value.gitSha !== gitSha) throw new Error(`${fileName} gitSha does not match IMAGE_MANIFEST_GIT_SHA.`);
  if (value.environment !== environment) throw new Error(`${fileName} environment does not match.`);
  const imageName = String(value.image || "").trim().replace(/@sha256:[a-f0-9]{64}$/u, "");
  const digest = String(value.digest || "").trim();
  entries[target] = assertDigestImage(`${imageName}@${digest}`, `${target} image`);
}

for (const target of ["api", "web", "backoffice"]) {
  if (!entries[target]) throw new Error(`Image digest input for ${target} is missing.`);
}
if (new Set(Object.values(entries)).size !== 3) throw new Error("Container image references must be distinct.");

const createdAt = new Date().toISOString();
const outputPath = resolve(
  readArg("--output")
  || process.env.IMAGE_MANIFEST_OUTPUT_PATH
  || `.release/evidence/container-image-manifest-${environment}-${timestampForFile(new Date(createdAt))}-${gitSha.slice(0, 12)}.json`
);
const receipt = await writeJsonReceipt(outputPath, {
  schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
  kind: "container_image_manifest",
  status: "ready",
  createdAt,
  gitSha,
  environment,
  images: entries
});
process.stdout.write(`${JSON.stringify({
  ok: true,
  environment,
  gitSha,
  outputPath: receipt.path,
  checksum: receipt.checksum,
  images: entries
}, null, 2)}\n`);

function readArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

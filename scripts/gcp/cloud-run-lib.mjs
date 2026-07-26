#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const CONTRACT_PATH = "deploy/gcp/cloud-run.contract.json";
const ENVIRONMENTS = new Set(["staging", "production"]);
const FULL_SHA = /^[a-f0-9]{40}$/u;
const DIGEST_IMAGE = /^.+@sha256:[a-f0-9]{64}$/u;

export async function loadCloudRunContract(path = CONTRACT_PATH) {
  const resolved = resolve(path);
  const source = await readFile(resolved, "utf8");
  const contract = JSON.parse(source);
  if (contract.schemaVersion !== 1) throw new Error("Unsupported Cloud Run contract schemaVersion.");
  for (const key of ["region", "schedulerRegion", "repository", "projects", "services", "jobs", "serviceAccounts"]) {
    if (!contract[key]) throw new Error(`Cloud Run contract is missing ${key}.`);
  }
  return { contract, path: resolved, sha256: createHash("sha256").update(source).digest("hex") };
}

export function parseFlag(name, argv = process.argv.slice(2)) {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? "";
}

export function assertEnvironment(value) {
  const environment = String(value || "").trim().toLowerCase();
  if (!ENVIRONMENTS.has(environment)) throw new Error("environment must be staging or production.");
  return environment;
}

export function expectedProject(contract, environment) {
  const project = contract.projects[environment];
  if (!project) throw new Error(`No project is configured for ${environment}.`);
  return project;
}

export function assertFullGitSha(value, name = "gitSha") {
  const sha = String(value || "").trim();
  if (!FULL_SHA.test(sha)) throw new Error(`${name} must be a full lowercase 40-character Git SHA.`);
  return sha;
}

export function assertDigestImage(value, name) {
  const image = String(value || "").trim();
  if (!DIGEST_IMAGE.test(image)) throw new Error(`${name} must be pinned as image@sha256:<64 lowercase hex>.`);
  return image;
}

export function confirmationValue(action, environment) {
  return `${action}_${environment}`.toUpperCase().replaceAll("-", "_");
}

export function assertConfirmation(action, environment, env = process.env) {
  const name = `GCP_${action.toUpperCase().replaceAll("-", "_")}_CONFIRM`;
  const expected = confirmationValue(action, environment);
  if (env[name] !== expected) throw new Error(`${name} must equal ${expected}.`);
  return { name, expected };
}

export function serviceAccountEmail(contract, role, project) {
  const id = contract.serviceAccounts[role];
  if (!id) throw new Error(`Unknown service account role: ${role}`);
  return `${id}@${project}.iam.gserviceaccount.com`;
}

export function secretId(contract, key) {
  const normalized = `${contract.secretPrefix}-${key.toLowerCase().replaceAll("_", "-")}`
    .replace(/[^a-z0-9-]/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 63);
  if (!normalized) throw new Error(`Cannot create a secret id for ${key}.`);
  return normalized;
}

export function normalizeGcpLabelValue(
  value,
  name = "GCP label value",
) {
  const normalized = String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/[-_]{2,}/gu, "-")
    .replace(/^[-_]+|[-_]+$/gu, "")
    .slice(0, 63)
    .replace(/[-_]+$/gu, "");

  if (!normalized) {
    throw new Error(
      `${name} cannot be normalized to a valid GCP label value.`,
    );
  }

  return normalized;
}

export async function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: options.capture || options.input !== undefined ? ["pipe", "pipe", "pipe"] : "inherit",
      shell: false
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise({ code, signal, stdout, stderr });
        return;
      }
      const suffix = stderr.trim() ? `\n${stderr.trim()}` : "";
      rejectPromise(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "null"}${signal ? ` signal ${signal}` : ""}.${suffix}`));
    });
    if (options.input !== undefined) child.stdin?.end(options.input);
    else if (child.stdin) child.stdin.end();
  });
}

export async function gcloud(args, options = {}) {
  return run("gcloud", [...args, "--quiet"], options);
}

export function isGcloudNotFoundError(error) {
  const message = safeMessage(error);
  return /(?:^|\b)NOT_FOUND(?:\b|:)|(?:^|\b)(?:code|status(?: code)?)\s*[:=]?\s*404(?:\b|$)/iu.test(message);
}

export async function gcloudResourceExists(
  args,
  {
    execute = gcloud,
    resource = "GCP resource"
  } = {}
) {
  try {
    await execute(args, { capture: true });
    return true;
  } catch (error) {
    if (isGcloudNotFoundError(error)) return false;
    throw new Error(
      `${resource} existence check failed: ${safeMessage(error)}`,
      { cause: error }
    );
  }
}

export async function gcloudJsonResource(
  args,
  {
    execute = gcloud,
    resource = "GCP resource"
  } = {}
) {
  try {
    const result = await execute(
      [...args, "--format=json"],
      { capture: true }
    );
    return JSON.parse(result.stdout || "null");
  } catch (error) {
    if (isGcloudNotFoundError(error)) return null;
    throw new Error(
      `${resource} describe failed: ${safeMessage(error)}`,
      { cause: error }
    );
  }
}

export async function readJsonCommand(command, args) {
  const result = await run(command, args, { capture: true });
  return JSON.parse(result.stdout || "null");
}

export async function assertGcloudContext(contract, environment, options = {}) {
  const project = expectedProject(contract, environment);
  const accountResult = await gcloud(["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"], { capture: true });
  const account = accountResult.stdout.trim();
  if (!account) throw new Error("gcloud has no active authenticated account.");
  const projectResult = await gcloud(["config", "get-value", "project"], { capture: true });
  const activeProject = projectResult.stdout.trim();
  if (activeProject !== project) throw new Error(`Active gcloud project must be ${project}; found ${activeProject || "none"}.`);
  const billing = await gcloud(["billing", "projects", "describe", project, "--format=json"], { capture: true });
  const billingData = JSON.parse(billing.stdout);
  if (billingData.billingEnabled !== true) throw new Error(`Billing is not enabled for ${project}.`);
  if (options.requireRegion !== false) {
    const regionResult = await gcloud(["config", "get-value", "run/region"], { capture: true });
    const activeRegion = regionResult.stdout.trim();
    if (activeRegion !== contract.region) throw new Error(`Active run/region must be ${contract.region}; found ${activeRegion || "none"}.`);
  }
  return { account, project, projectNumber: String((await gcloud(["projects", "describe", project, "--format=value(projectNumber)"], { capture: true })).stdout).trim() };
}

export async function writeJson(path, value) {
  const resolved = resolve(path);
  await mkdir(dirname(resolved), { recursive: true, mode: 0o700 });
  const temporary = `${resolved}.${process.pid}.tmp`;
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, resolved);
  const checksum = createHash("sha256").update(content).digest("hex");
  await writeFile(`${resolved}.sha256`, `${checksum}  ${basename(resolved)}\n`, { mode: 0o600 });
  return { path: resolved, checksum };
}

export async function writeEnvYaml(path, values) {
  const lines = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}: ${JSON.stringify(String(value))}`);
  const resolved = resolve(path);
  await mkdir(dirname(resolved), { recursive: true, mode: 0o700 });
  await writeFile(resolved, `${lines.join("\n")}\n`, { mode: 0o600 });
  return resolved;
}

export function artifactRoot(contract, environment) {
  return resolve(process.env.BABYLOOP_GCP_ARTIFACT_ROOT || contract.artifactDirectory, environment);
}

export function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

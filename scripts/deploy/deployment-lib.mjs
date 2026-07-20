import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

export const DEPLOY_ENVIRONMENTS = new Set(["staging", "production"]);
export const DIGEST_IMAGE_PATTERN = /^[^\s]+@sha256:[a-f0-9]{64}$/u;

export function assertEnvironment(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!DEPLOY_ENVIRONMENTS.has(normalized)) {
    throw new Error("DEPLOY_ENVIRONMENT must be staging or production.");
  }
  return normalized;
}

export function assertDigestImage(value, name) {
  const normalized = String(value || "").trim();
  if (!DIGEST_IMAGE_PATTERN.test(normalized)) {
    throw new Error(`${name} must be pinned as registry/name@sha256:<64 lowercase hex>.`);
  }
  return normalized;
}

export async function loadEnvFile(path) {
  const resolvedPath = resolve(path);
  const content = await readFile(resolvedPath, "utf8");
  const parsed = {};

  for (const [index, sourceLine] of content.split(/\r?\n/u).entries()) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error(`Invalid env line ${index + 1} in ${resolvedPath}.`);
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/u.test(key)) {
      throw new Error(`Invalid env key ${JSON.stringify(key)} at line ${index + 1}.`);
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (Object.hasOwn(parsed, key)) {
      throw new Error(`Duplicate env key ${key} at line ${index + 1}.`);
    }
    parsed[key] = value;
  }

  return { path: resolvedPath, values: parsed };
}

export function mergedEnvironment(fileValues, overrides = {}) {
  return {
    ...fileValues,
    ...process.env,
    ...overrides
  };
}

export async function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: false
    });
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => { stdout += chunk; });
      child.stderr?.on("data", (chunk) => { stderr += chunk; });
    }
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise({ code, signal, stdout, stderr });
        return;
      }
      const suffix = options.capture && stderr.trim() ? `\n${stderr.trim()}` : "";
      rejectPromise(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "null"}${signal ? ` signal ${signal}` : ""}.${suffix}`));
    });
  });
}

export async function writeJsonReceipt(path, value) {
  const resolvedPath = resolve(path);
  await mkdir(dirname(resolvedPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${resolvedPath}.${process.pid}.tmp`;
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(temporaryPath, content, { mode: 0o600 });
  await rename(temporaryPath, resolvedPath);
  const checksum = createHash("sha256").update(content).digest("hex");
  await writeFile(`${resolvedPath}.sha256`, `${checksum}  ${basename(resolvedPath)}\n`, { mode: 0o600 });
  return { checksum, path: resolvedPath };
}

export function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}

export function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import {
  loadEnvFile,
  mergedEnvironment,
  required,
  runCommand,
  timestampForFile,
  writeJsonReceipt
} from "./deployment-lib.mjs";
import { auditRuntimeEnv } from "./runtime-env-lib.mjs";
import {
  PROVIDER_PROBE_CHECKS,
  RELEASE_EVIDENCE_SCHEMA_VERSION
} from "./release-evidence-lib.mjs";

const envFile = resolve(readArg("--env-file") || required(process.env.DEPLOY_ENV_FILE, "DEPLOY_ENV_FILE"));
const mode = readArg("--mode") || process.env.PROVIDER_PROBE_MODE || "plan";
const loaded = await loadEnvFile(envFile);
const environment = loaded.values.DEPLOY_ENVIRONMENT;
const audit = await auditRuntimeEnv({ envFile, target: environment });
const commandEnv = mergedEnvironment(audit.values, { DEPLOY_ENV_FILE: envFile });
const plan = buildPlan(audit.values);

if (mode === "plan") {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode,
    environment,
    probes: plan.map(({ name, mutating, command }) => ({ name, mutating, command }))
  }, null, 2)}\n`);
  process.exit(0);
}
if (mode !== "live") throw new Error("PROVIDER_PROBE_MODE must be plan or live.");

const expectedConfirmation = environment === "production"
  ? "PROBE_PRODUCTION_PROVIDERS"
  : "PROBE_STAGING_PROVIDERS";
if (process.env.PROVIDER_PROBE_CONFIRM !== expectedConfirmation) {
  throw new Error(`PROVIDER_PROBE_CONFIRM=${expectedConfirmation} is required for live provider probes.`);
}

const gitSha = process.env.DEPLOY_GIT_SHA || await gitHead();
const checks = {};
const results = {};

for (const probe of plan) {
  const startedAt = performance.now();
  try {
    const output = await probe.run();
    checks[probe.name] = true;
    results[probe.name] = {
      status: "passed",
      durationMs: round(performance.now() - startedAt),
      mutating: probe.mutating,
      summary: output ?? null
    };
  } catch (error) {
    checks[probe.name] = false;
    results[probe.name] = {
      status: "failed",
      durationMs: round(performance.now() - startedAt),
      mutating: probe.mutating,
      error: normalizeError(error)
    };
    break;
  }
}

for (const name of PROVIDER_PROBE_CHECKS) {
  if (!Object.hasOwn(checks, name)) {
    checks[name] = false;
    results[name] = { status: "not_run", durationMs: 0, mutating: false };
  }
}

const failed = PROVIDER_PROBE_CHECKS.filter((name) => checks[name] !== true);
if (failed.length > 0) {
  process.stderr.write(`${JSON.stringify({ ok: false, environment, failed, results }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  const createdAt = new Date().toISOString();
  const outputPath = resolve(
    readArg("--output")
    || process.env.PROVIDER_PROBE_EVIDENCE_PATH
    || `.release/evidence/${environment}-provider-probe-${timestampForFile(new Date(createdAt))}-${gitSha.slice(0, 12)}.json`
  );
  const receipt = await writeJsonReceipt(outputPath, {
    schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
    kind: "provider_probe_evidence",
    status: "passed",
    mode: "live",
    createdAt,
    gitSha,
    environment,
    checks,
    results
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    environment,
    outputPath: receipt.path,
    checksum: receipt.checksum,
    checks
  }, null, 2)}\n`);
}

function buildPlan(values) {
  let readinessCache = null;
  async function readiness() {
    if (readinessCache) return readinessCache;
    const response = await fetchWithTimeout(`${strip(values.NEXT_PUBLIC_API_BASE_URL)}/health/ready`, {}, 10000);
    if (!response.ok) throw new Error(`API readiness returned ${response.status}.`);
    readinessCache = await response.json();
    return readinessCache;
  }

  return [
    {
      name: "apiReadiness",
      mutating: false,
      command: "GET /health/ready",
      run: async () => {
        const body = await readiness();
        if (body.ready !== true) throw new Error("API readiness body returned ready=false.");
        return { checkedAt: body.checkedAt || null };
      }
    },
    readinessDependencyProbe("databaseReadiness", "database"),
    readinessDependencyProbe("storageReadiness", "storage"),
    readinessDependencyProbe("qdrantReadiness", "ragVectorStore"),
    readinessDependencyProbe("redisReadiness", "ragRedis"),
    readinessDependencyProbe("notificationWorkerReadiness", "notificationWorker"),
    readinessDependencyProbe("childReminderWorkerReadiness", "childReminderWorker"),
    {
      name: "r2RoundTrip",
      mutating: true,
      command: "pnpm --filter @babyloop/api storage:smoke:r2",
      run: async () => {
        requireMutationApproval("PROVIDER_PROBE_ALLOW_R2_WRITE");
        await runCommand("pnpm", ["--filter", "@babyloop/api", "storage:smoke:r2"], {
          env: { ...commandEnv, IMAGE_STORAGE_R2_SMOKE_ALLOW_WRITE: "true" }
        });
        return { command: "storage:smoke:r2" };
      }
    },
    {
      name: "notificationDelivery",
      mutating: true,
      command: "pnpm --filter @babyloop/api notifications:smoke:providers",
      run: async () => {
        requireMutationApproval("PROVIDER_PROBE_ALLOW_NOTIFICATION_SEND");
        if (!values.NOTIFICATION_SMOKE_RECIPIENT_EMAIL) throw new Error("NOTIFICATION_SMOKE_RECIPIENT_EMAIL is required.");
        if (!values.NOTIFICATION_SMOKE_EXPO_PUSH_TOKEN) throw new Error("NOTIFICATION_SMOKE_EXPO_PUSH_TOKEN is required.");
        await runCommand("pnpm", ["--filter", "@babyloop/api", "notifications:smoke:providers"], { env: commandEnv });
        return { command: "notifications:smoke:providers" };
      }
    },
    {
      name: "ragAcceptance",
      mutating: false,
      command: "pnpm rag:acceptance:live",
      run: async () => {
        await runCommand("pnpm", ["rag:acceptance:live"], { env: commandEnv });
        return { command: "rag:acceptance:live" };
      }
    },
    {
      name: "analyticsDatabase",
      mutating: false,
      command: "pnpm smoke:analytics:db",
      run: async () => {
        await runCommand("pnpm", ["smoke:analytics:db"], { env: commandEnv });
        return { command: "smoke:analytics:db" };
      }
    }
  ];

  function readinessDependencyProbe(name, dependencyName) {
    return {
      name,
      mutating: false,
      command: `GET /health/ready -> ${dependencyName}`,
      run: async () => {
        const body = await readiness();
        const dependency = body.dependencies?.[dependencyName];
        if (!dependency || dependency.status !== "ready") {
          throw new Error(`${dependencyName} readiness is ${dependency?.status || "missing"}.`);
        }
        return { status: dependency.status, durationMs: dependency.durationMs ?? null };
      }
    };
  }
}

function requireMutationApproval(name) {
  if (process.env[name] !== "true") throw new Error(`${name}=true is required for the mutating provider probe.`);
}
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "error" });
  } finally {
    clearTimeout(timeout);
  }
}
async function gitHead() {
  const result = await runCommand("git", ["rev-parse", "HEAD"], { capture: true });
  return result.stdout.trim();
}
function strip(value) {
  return String(value || "").replace(/\/+$/u, "");
}
function normalizeError(error) {
  return error instanceof Error ? error.message.slice(0, 500) : "Provider probe failed.";
}
function round(value) {
  return Math.round(value * 100) / 100;
}
function readArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

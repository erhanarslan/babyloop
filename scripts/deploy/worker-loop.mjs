#!/usr/bin/env node
import { spawn } from "node:child_process";

const WORKERS = {
  notification: "dist/scripts/process-notification-deliveries.js",
  "child-reminder": "dist/scripts/process-child-reminders.js"
};

const workerKind = process.argv[2];
const entrypoint = WORKERS[workerKind];
if (!entrypoint) {
  process.stderr.write(`Unknown worker kind: ${String(workerKind)}\n`);
  process.exit(2);
}

const intervalMs = readSeconds("BABYLOOP_WORKER_INTERVAL_SECONDS", 30) * 1000;
const failureBackoffMs = readSeconds("BABYLOOP_WORKER_FAILURE_BACKOFF_SECONDS", 30) * 1000;
let stopping = false;
let activeChild = null;

const requestStop = (signal) => {
  if (stopping) return;
  stopping = true;
  process.stdout.write(`${JSON.stringify({ event: "worker_loop_shutdown_requested", signal, workerKind })}\n`);
  activeChild?.kill("SIGTERM");
};
process.once("SIGTERM", () => requestStop("SIGTERM"));
process.once("SIGINT", () => requestStop("SIGINT"));

while (!stopping) {
  const startedAt = new Date();
  const result = await runCycle(entrypoint);
  const elapsedMs = Date.now() - startedAt.getTime();
  process.stdout.write(`${JSON.stringify({
    event: "worker_loop_cycle_completed",
    workerKind,
    exitCode: result.code,
    signal: result.signal,
    elapsedMs
  })}\n`);

  if (stopping) break;
  await delay(result.code === 0 ? Math.max(0, intervalMs - elapsedMs) : failureBackoffMs);
}

process.stdout.write(`${JSON.stringify({ event: "worker_loop_stopped", workerKind })}\n`);

function runCycle(scriptPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: process.env,
      stdio: "inherit",
      shell: false
    });
    activeChild = child;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      activeChild = null;
      resolve(result);
    };
    child.once("error", (error) => {
      process.stderr.write(`${JSON.stringify({ event: "worker_loop_spawn_failed", workerKind, message: error.message })}\n`);
      finish({ code: 1, signal: null });
    });
    child.once("exit", (code, signal) => {
      finish({ code: code ?? 1, signal });
    });
  });
}

function delay(milliseconds) {
  if (milliseconds <= 0 || stopping) return Promise.resolve();
  const deadline = Date.now() + milliseconds;
  return new Promise((resolve) => {
    const tick = () => {
      if (stopping || Date.now() >= deadline) {
        resolve();
        return;
      }
      setTimeout(tick, Math.min(200, deadline - Date.now()));
    };
    tick();
  });
}

function readSeconds(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isInteger(parsed) || parsed < 5 || parsed > 3600) return fallback;
  return parsed;
}

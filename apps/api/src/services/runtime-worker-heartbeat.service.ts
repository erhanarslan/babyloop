import { runtimeWorkerHeartbeats } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export type RuntimeWorkerName = "notification_delivery" | "child_reminder";
export type RuntimeWorkerStatus = "running" | "idle" | "failed" | "stopping";

export type RuntimeWorkerHeartbeatSnapshot = {
  workerName: RuntimeWorkerName;
  workerId: string;
  status: RuntimeWorkerStatus;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastHeartbeatAt: string;
  lastErrorCode: string | null;
  lastErrorMessageRedacted: string | null;
  lastSummary: Record<string, unknown>;
};

export async function markRuntimeWorkerStarted(
  app: FastifyInstance,
  input: {
    workerName: RuntimeWorkerName;
    workerId: string;
    now?: Date;
  }
): Promise<void> {
  const now = input.now ?? new Date();

  await app.db
    .insert(runtimeWorkerHeartbeats)
    .values({
      workerName: input.workerName,
      workerId: sanitizeWorkerId(input.workerId),
      status: "running",
      lastStartedAt: now,
      lastHeartbeatAt: now,
      lastErrorCode: null,
      lastErrorMessageRedacted: null,
      lastSummary: {},
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: runtimeWorkerHeartbeats.workerName,
      set: {
        workerId: sanitizeWorkerId(input.workerId),
        status: "running",
        lastStartedAt: now,
        lastHeartbeatAt: now,
        lastErrorCode: null,
        lastErrorMessageRedacted: null,
        updatedAt: now
      }
    });
}

export async function markRuntimeWorkerCompleted(
  app: FastifyInstance,
  input: {
    workerName: RuntimeWorkerName;
    workerId: string;
    summary?: Record<string, unknown>;
    now?: Date;
  }
): Promise<void> {
  const now = input.now ?? new Date();

  await app.db
    .insert(runtimeWorkerHeartbeats)
    .values({
      workerName: input.workerName,
      workerId: sanitizeWorkerId(input.workerId),
      status: "idle",
      lastStartedAt: now,
      lastCompletedAt: now,
      lastHeartbeatAt: now,
      lastErrorCode: null,
      lastErrorMessageRedacted: null,
      lastSummary: sanitizeSummary(input.summary ?? {}),
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: runtimeWorkerHeartbeats.workerName,
      set: {
        workerId: sanitizeWorkerId(input.workerId),
        status: "idle",
        lastCompletedAt: now,
        lastHeartbeatAt: now,
        lastErrorCode: null,
        lastErrorMessageRedacted: null,
        lastSummary: sanitizeSummary(input.summary ?? {}),
        updatedAt: now
      }
    });
}

export async function markRuntimeWorkerFailed(
  app: FastifyInstance,
  input: {
    workerName: RuntimeWorkerName;
    workerId: string;
    error: unknown;
    now?: Date;
  }
): Promise<void> {
  const now = input.now ?? new Date();
  const normalized = normalizeWorkerError(input.error);

  await app.db
    .insert(runtimeWorkerHeartbeats)
    .values({
      workerName: input.workerName,
      workerId: sanitizeWorkerId(input.workerId),
      status: "failed",
      lastStartedAt: now,
      lastHeartbeatAt: now,
      lastErrorCode: normalized.code,
      lastErrorMessageRedacted: normalized.message,
      lastSummary: {},
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: runtimeWorkerHeartbeats.workerName,
      set: {
        workerId: sanitizeWorkerId(input.workerId),
        status: "failed",
        lastHeartbeatAt: now,
        lastErrorCode: normalized.code,
        lastErrorMessageRedacted: normalized.message,
        updatedAt: now
      }
    });
}

export async function getRuntimeWorkerHeartbeat(
  app: FastifyInstance,
  workerName: RuntimeWorkerName
): Promise<RuntimeWorkerHeartbeatSnapshot | null> {
  const [row] = await app.db
    .select()
    .from(runtimeWorkerHeartbeats)
    .where(eq(runtimeWorkerHeartbeats.workerName, workerName))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    workerName: row.workerName as RuntimeWorkerName,
    workerId: row.workerId,
    status: row.status as RuntimeWorkerStatus,
    lastStartedAt: row.lastStartedAt?.toISOString() ?? null,
    lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
    lastHeartbeatAt: row.lastHeartbeatAt.toISOString(),
    lastErrorCode: row.lastErrorCode,
    lastErrorMessageRedacted: row.lastErrorMessageRedacted,
    lastSummary: sanitizeSummary(row.lastSummary)
  };
}

function sanitizeWorkerId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_.:-]/gu, "-").slice(0, 120) || "unknown-worker";
}

function sanitizeSummary(summary: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(summary).slice(0, 40)) {
    if (!/^[a-zA-Z0-9_]{1,80}$/u.test(key)) {
      continue;
    }

    if (typeof value === "boolean" || typeof value === "number" || value === null) {
      safe[key] = value;
      continue;
    }

    if (typeof value === "string") {
      safe[key] = value.slice(0, 160);
    }
  }

  return safe;
}

function normalizeWorkerError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    const code = "code" in error ? String(error.code) : error.name;
    return {
      code: sanitizeErrorText(code, 80) || "WORKER_FAILED",
      message: sanitizeErrorText(error.message, 240) || "Worker execution failed."
    };
  }

  return {
    code: "WORKER_FAILED",
    message: "Worker execution failed."
  };
}

function sanitizeErrorText(value: string, maxLength: number): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[redacted-database-url]")
    .replace(/bearer\s+[a-z0-9._~+/=-]+/giu, "Bearer [redacted]")
    .replace(/(?:token|secret|password|authorization|cookie)\s*[:=]\s*[^\s,;]+/giu, "$1=[redacted]")
    .trim()
    .slice(0, maxLength);
}

import {
  notificationDeliveryLogs,
  runtimeWorkerHeartbeats
} from "@babyloop/database/schema";
import { and, count, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ApiRuntimeConfig } from "../config/env.js";
import { probeImageStorageReadiness } from "./image-storage.service.js";
import { QdrantVectorStore } from "./rag-qdrant-vector-store.service.js";
import { RagRedisClient } from "./rag-redis.service.js";
import {
  getRuntimeWorkerHeartbeat,
  type RuntimeWorkerName
} from "./runtime-worker-heartbeat.service.js";
import { verifyDatabaseMigrationHead } from "./database-migration-head.service.js";

export type ReadinessDependencyStatus = "ready" | "degraded" | "failed" | "not_configured";

export type ReadinessDependencyResult = {
  status: ReadinessDependencyStatus;
  required: boolean;
  durationMs: number;
  code: string | null;
  details?: Record<string, string | number | boolean | null>;
};

export type RuntimeReadinessResult = {
  ready: boolean;
  checkedAt: string;
  expectedDatabaseMigration: string;
  dependencies: {
    database: ReadinessDependencyResult;
    schema: ReadinessDependencyResult;
    storage: ReadinessDependencyResult;
    ragVectorStore: ReadinessDependencyResult;
    ragRedis: ReadinessDependencyResult;
    notificationWorker: ReadinessDependencyResult;
    childReminderWorker: ReadinessDependencyResult;
    notificationClaims: ReadinessDependencyResult;
  };
};

export async function evaluateRuntimeReadiness(
  app: FastifyInstance,
  options: {
    config: ApiRuntimeConfig;
    env?: NodeJS.ProcessEnv;
    now?: Date;
  }
): Promise<RuntimeReadinessResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const timeoutMs = readPositiveInteger(env.HEALTH_READINESS_TIMEOUT_MS, 3000);
  const databasePromise = runProbe("database", true, timeoutMs, async () => {
    assertDatabaseAvailable(app);
    await app.db.execute(sql`select 1 as ok`);
    return {};
  });

  const schemaPromise = runProbe("schema", true, timeoutMs, async () => {
    assertDatabaseAvailable(app);
    const migration = await verifyDatabaseMigrationHead(app.db);
    return {
      actualMigrationHash: migration.actualMigrationHash,
      expectedMigration: migration.tag,
      expectedMigrationHash: migration.hash,
      verifiedTables: migration.verifiedTables.join(","),
    };
  });

  const storagePromise = runProbe("storage", true, timeoutMs, async () => {
    const result = await probeImageStorageReadiness({
      env,
      uploadRoot: options.config.uploadRoot
    });
    return { driver: result.driver };
  });

  const ragConfig = options.config.rag;
  const ragVectorStorePromise = ragConfig.enabled
    ? runProbe("rag_vector_store", true, timeoutMs, async () => {
        const store = new QdrantVectorStore({
          collectionName: ragConfig.qdrantCollection,
          url: ragConfig.qdrantUrl,
          vectorSize: ragConfig.qdrantVectorSize,
          ...(ragConfig.qdrantApiKey ? { apiKey: ragConfig.qdrantApiKey } : {})
        });
        const info = await store.getCollectionInfo();
        if (info.status === "red" || info.status === "unknown") {
          throw readinessError("QDRANT_NOT_READY");
        }
        return {
          collection: ragConfig.qdrantCollection,
          collectionStatus: info.status,
          pointsCount: info.pointsCount
        };
      })
    : Promise.resolve(notConfigured(false, "RAG_DISABLED"));

  const redisRequired = ragConfig.enabled && (
    ragConfig.cacheBackend === "redis" ||
    ragConfig.metricsBackend === "redis" ||
    ragConfig.usageLimitsBackend === "redis"
  );
  const ragRedisPromise = redisRequired && ragConfig.enabled
    ? runProbe("rag_redis", true, timeoutMs, async () => {
        const client = new RagRedisClient({
          enabled: ragConfig.redisEnabled,
          keyPrefix: ragConfig.redisKeyPrefix,
          url: ragConfig.redisUrl,
          connectTimeoutMs: Math.min(ragConfig.redisConnectTimeoutMs, timeoutMs)
        });
        const pong = await client.ping();
        if (!pong) {
          throw readinessError("REDIS_PING_FAILED");
        }
        return { ping: true };
      })
    : Promise.resolve(notConfigured(false, ragConfig.enabled ? "REDIS_NOT_REQUIRED" : "RAG_DISABLED"));

  const notificationWorkerPromise = checkWorkerReadiness(app, {
    now,
    timeoutMs,
    workerName: "notification_delivery",
    required: readBoolean(env.HEALTH_REQUIRE_NOTIFICATION_WORKER, false),
    maxStalenessSeconds: readPositiveInteger(env.NOTIFICATION_WORKER_MAX_STALENESS_SECONDS, 900)
  });
  const childReminderWorkerPromise = checkWorkerReadiness(app, {
    now,
    timeoutMs,
    workerName: "child_reminder",
    required: readBoolean(env.HEALTH_REQUIRE_CHILD_REMINDER_WORKER, false),
    maxStalenessSeconds: readPositiveInteger(env.CHILD_REMINDER_WORKER_MAX_STALENESS_SECONDS, 900)
  });
  const notificationClaimsPromise = checkStaleNotificationClaims(app, {
    now,
    timeoutMs,
    required: readBoolean(env.HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS, false)
  });

  const [
    database,
    schema,
    storage,
    ragVectorStore,
    ragRedis,
    notificationWorker,
    childReminderWorker,
    notificationClaims
  ] = await Promise.all([
    databasePromise,
    schemaPromise,
    storagePromise,
    ragVectorStorePromise,
    ragRedisPromise,
    notificationWorkerPromise,
    childReminderWorkerPromise,
    notificationClaimsPromise
  ]);

  const dependencies = {
    database,
    schema,
    storage,
    ragVectorStore,
    ragRedis,
    notificationWorker,
    childReminderWorker,
    notificationClaims
  };
  const ready = Object.values(dependencies).every((dependency) => (
    !dependency.required || dependency.status === "ready" || dependency.status === "degraded"
  ));

  return {
    ready,
    checkedAt: now.toISOString(),
    expectedDatabaseMigration: schema.details?.expectedMigration?.toString() ?? "unverified",
    dependencies
  };
}

async function checkWorkerReadiness(
  app: FastifyInstance,
  input: {
    now: Date;
    timeoutMs: number;
    workerName: RuntimeWorkerName;
    required: boolean;
    maxStalenessSeconds: number;
  }
): Promise<ReadinessDependencyResult> {
  const startedAt = performance.now();

  if (!("db" in app) || !app.db) {
    return failed(input.required, "DATABASE_UNAVAILABLE", elapsedMs(startedAt));
  }

  try {
    const heartbeat = await withTimeout(input.timeoutMs, () => getRuntimeWorkerHeartbeat(app, input.workerName));
    const durationMs = elapsedMs(startedAt);

    if (!heartbeat) {
      return input.required
        ? failed(true, "WORKER_HEARTBEAT_MISSING", durationMs)
        : notConfigured(false, "WORKER_HEARTBEAT_MISSING");
    }

    const heartbeatAt = new Date(heartbeat.lastHeartbeatAt);
    const ageSeconds = Math.max(0, Math.floor((input.now.getTime() - heartbeatAt.getTime()) / 1000));

    if (heartbeat.status === "failed") {
      return failed(input.required, "WORKER_LAST_RUN_FAILED", durationMs);
    }

    if (ageSeconds > input.maxStalenessSeconds) {
      return {
        status: input.required ? "failed" : "degraded",
        required: input.required,
        durationMs,
        code: "WORKER_HEARTBEAT_STALE",
        details: {
          workerName: input.workerName,
          workerStatus: heartbeat.status,
          heartbeatAgeSeconds: ageSeconds,
          maxStalenessSeconds: input.maxStalenessSeconds
        }
      };
    }

    return {
      status: "ready",
      required: input.required,
      durationMs,
      code: null,
      details: {
        workerName: input.workerName,
        workerStatus: heartbeat.status,
        heartbeatAgeSeconds: ageSeconds,
        maxStalenessSeconds: input.maxStalenessSeconds
      }
    };
  } catch (error) {
    return failed(input.required, normalizeProbeErrorCode(error), elapsedMs(startedAt));
  }
}

async function checkStaleNotificationClaims(
  app: FastifyInstance,
  input: {
    now: Date;
    timeoutMs: number;
    required: boolean;
  }
): Promise<ReadinessDependencyResult> {
  const startedAt = performance.now();

  try {
    const result = await withTimeout(input.timeoutMs, async () => {
      const [row] = await app.db
        .select({ count: count() })
        .from(notificationDeliveryLogs)
        .where(and(
          eq(notificationDeliveryLogs.status, "processing"),
          or(
            isNull(notificationDeliveryLogs.claimExpiresAt),
            lt(notificationDeliveryLogs.claimExpiresAt, input.now)
          )
        ));
      return Number(row?.count ?? 0);
    });
    const durationMs = elapsedMs(startedAt);

    if (result > 0) {
      return {
        status: input.required ? "failed" : "degraded",
        required: input.required,
        durationMs,
        code: "STALE_NOTIFICATION_CLAIMS",
        details: { staleClaimCount: result }
      };
    }

    return {
      status: "ready",
      required: input.required,
      durationMs,
      code: null,
      details: { staleClaimCount: 0 }
    };
  } catch (error) {
    return failed(input.required, normalizeProbeErrorCode(error), elapsedMs(startedAt));
  }
}

async function runProbe(
  _name: string,
  required: boolean,
  timeoutMs: number,
  probe: () => Promise<Record<string, string | number | boolean | null>>
): Promise<ReadinessDependencyResult> {
  const startedAt = performance.now();

  try {
    const details = await withTimeout(timeoutMs, probe);
    return {
      status: "ready",
      required,
      durationMs: elapsedMs(startedAt),
      code: null,
      ...(Object.keys(details).length > 0 ? { details } : {})
    };
  } catch (error) {
    return failed(required, normalizeProbeErrorCode(error), elapsedMs(startedAt));
  }
}

function notConfigured(required: boolean, code: string): ReadinessDependencyResult {
  return {
    status: "not_configured",
    required,
    durationMs: 0,
    code
  };
}

function failed(required: boolean, code: string, durationMs: number): ReadinessDependencyResult {
  return {
    status: "failed",
    required,
    durationMs,
    code
  };
}

function assertDatabaseAvailable(app: FastifyInstance): void {
  if (!("db" in app) || !app.db) {
    throw readinessError("DATABASE_NOT_CONFIGURED");
  }
}

function readinessError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function normalizeProbeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return sanitizeCode(String(error.code));
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return "PROBE_TIMEOUT";
  }

  return "PROBE_FAILED";
}

async function withTimeout<T>(timeoutMs: number, action: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      action(),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          const error = new Error("Readiness probe timed out.");
          error.name = "TimeoutError";
          reject(error);
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function elapsedMs(startedAt: number): number {
  return Number((performance.now() - startedAt).toFixed(2));
}

function sanitizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9_:-]/gu, "_").slice(0, 80) || "PROBE_FAILED";
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

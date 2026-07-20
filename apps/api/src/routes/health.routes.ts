import type { FastifyInstance } from "fastify";
import type { ApiRuntimeConfig } from "../config/env.js";
import { getImageStorageConfigPreview } from "../services/image-storage.service.js";
import type { RuntimeMetricsRegistry } from "../services/runtime-metrics.service.js";
import {
  evaluateRuntimeReadiness,
  type RuntimeReadinessResult
} from "../services/runtime-readiness.service.js";


type HealthDependencyStatus = {
  configured: boolean;
};

type HealthResponse = {
  ok: true;
  service: "babyloop-api";
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  endpoints: {
    liveness: "/health/live";
    readiness: "/health/ready";
    metrics: "/internal/metrics" | null;
  };
  dependencies: {
    auth: HealthDependencyStatus;
    database: HealthDependencyStatus;
    email: {
      mode: "noop" | "provider";
    };
    rag: {
      enabled: boolean;
      cacheBackend: "memory" | "redis" | null;
      metricsBackend: "memory" | "redis" | null;
      usageLimitsBackend: "memory" | "redis" | null;
    };
    storage: {
      configured: boolean;
      driver: "local" | "s3";
      localFallback: boolean;
    };
  };
};

type LivenessResponse = {
  ok: true;
  live: true;
  service: "babyloop-api";
  timestamp: string;
  uptimeSeconds: number;
};

type RegisterHealthRoutesOptions = {
  config: ApiRuntimeConfig;
  env?: NodeJS.ProcessEnv;
  metrics: RuntimeMetricsRegistry;
  startedAt: Date;
  version?: string;
};

const DEFAULT_API_VERSION = "0.1.0";

export function registerHealthRoutes(
  app: FastifyInstance,
  options: RegisterHealthRoutesOptions,
): void {
  app.get<{ Reply: HealthResponse }>("/health", async () => {
    const env = options.env ?? process.env;
    const storage = getImageStorageConfigPreview(env);

    return {
      ok: true,
      service: "babyloop-api",
      version: options.version ?? env.npm_package_version ?? DEFAULT_API_VERSION,
      environment: normalizeEnvironment(env.NODE_ENV),
      timestamp: new Date().toISOString(),
      uptimeSeconds: getUptimeSeconds(options.startedAt),
      endpoints: {
        liveness: "/health/live",
        readiness: "/health/ready",
        metrics: isMetricsEnabled(env) ? "/internal/metrics" : null
      },
      dependencies: {
        auth: {
          configured: Boolean(options.config.authSecret),
        },
        database: {
          configured: Boolean(options.config.databaseUrl),
        },
        email: {
          mode: options.config.emailDeliveryMode,
        },
        rag: getRagDependencyStatus(options.config.rag),
        storage: {
          configured: storage.driver === "local" ? true : storage.s3Configured,
          driver: storage.driver,
          localFallback: storage.localFallback,
        },
      },
    };
  });

  app.get<{ Reply: LivenessResponse }>("/health/live", async () => ({
    ok: true,
    live: true,
    service: "babyloop-api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: getUptimeSeconds(options.startedAt)
  }));

  app.get("/health/ready", async (_request, reply) => {
    const readiness = await evaluateRuntimeReadiness(app, {
      config: options.config,
      env: options.env ?? process.env
    });

    options.metrics.recordReadiness(readiness.ready);

    return reply.status(readiness.ready ? 200 : 503).send(toReadinessResponse(readiness));
  });

  app.get("/internal/metrics", { schema: { hide: true } }, async (request, reply) => {
    const env = options.env ?? process.env;

    if (!isMetricsEnabled(env)) {
      return reply.status(404).send({
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Metrics endpoint is disabled."
        }
      });
    }

    const configuredToken = env.OBSERVABILITY_METRICS_TOKEN?.trim();
    const providedToken = readBearerToken(request.headers.authorization);

    if (!configuredToken || !providedToken || !constantTimeTextEqual(configuredToken, providedToken)) {
      return reply.status(401).send({
        ok: false,
        error: {
          code: "METRICS_AUTH_REQUIRED",
          message: "A valid metrics bearer token is required."
        }
      });
    }

    return reply
      .header("content-type", "text/plain; version=0.0.4; charset=utf-8")
      .header("cache-control", "no-store")
      .send(options.metrics.renderPrometheus());
  });
}

function toReadinessResponse(readiness: RuntimeReadinessResult): Record<string, unknown> {
  return {
    ok: readiness.ready,
    ready: readiness.ready,
    service: "babyloop-api",
    checkedAt: readiness.checkedAt,
    expectedDatabaseMigration: readiness.expectedDatabaseMigration,
    dependencies: readiness.dependencies
  };
}

function getRagDependencyStatus(
  rag: ApiRuntimeConfig["rag"],
): HealthResponse["dependencies"]["rag"] {
  if (!rag.enabled) {
    return {
      enabled: false,
      cacheBackend: null,
      metricsBackend: null,
      usageLimitsBackend: null,
    };
  }

  return {
    enabled: true,
    cacheBackend: rag.cacheBackend,
    metricsBackend: rag.metricsBackend,
    usageLimitsBackend: rag.usageLimitsBackend,
  };
}

function getUptimeSeconds(startedAt: Date): number {
  const elapsedMs = Date.now() - startedAt.getTime();

  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return 0;
  }

  return Math.floor(elapsedMs / 1000);
}

function normalizeEnvironment(value: string | undefined): string {
  const normalized = value?.trim();

  return normalized ? normalized : "development";
}

function isMetricsEnabled(env: NodeJS.ProcessEnv): boolean {
  return ["1", "true", "yes", "on"].includes((env.OBSERVABILITY_METRICS_ENABLED ?? "false").trim().toLowerCase());
}

function readBearerToken(value: string | undefined): string | null {
  const match = value?.match(/^Bearer\s+(.+)$/iu);
  return match?.[1]?.trim() || null;
}

function constantTimeTextEqual(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }

  return difference === 0;
}

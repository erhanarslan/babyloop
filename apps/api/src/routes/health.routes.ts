import type { FastifyInstance } from "fastify";
import type { ApiRuntimeConfig } from "../config/env.js";
import { getImageStorageConfigPreview } from "../services/image-storage.service.js";

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

type RegisterHealthRoutesOptions = {
  config: ApiRuntimeConfig;
  env?: NodeJS.ProcessEnv;
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

import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import type { RagRuntimeConfig } from "../config/env.js";
import { adminRagEvalRunBodySchema } from "../schemas/admin-rag.schemas.js";
import { requireBackofficePermission } from "../services/admin-context.service.js";
import { RagEvalRunner, type RagEvalRunSummary } from "../services/rag-eval-runner.service.js";
import { ragEvalCases } from "../services/rag-eval-cases.js";
import { RagOperationsService, type RagDocumentOperationSummary, type RagHealthSummary } from "../services/rag-operations.service.js";
import type { RagCacheStats } from "../services/rag-cache.service.js";
import type { RagMetricsSnapshot } from "../services/rag-metrics.service.js";
import type { RagRuntimeServices } from "../services/rag-runtime.service.js";
import type { RagUsageSummary } from "../services/rag-usage-limits.service.js";

type AdminRagHealthResponse = ApiResponse<{ health: RagHealthSummary }>;
type AdminRagDocumentsResponse = ApiResponse<{ documents: RagDocumentOperationSummary[] }>;
type AdminRagEvalCasesResponse = ApiResponse<{ cases: typeof ragEvalCases }>;
type AdminRagEvalRunResponse = ApiResponse<RagEvalRunSummary>;
type AdminRagCacheStatsResponse = ApiResponse<{ cache: RagCacheStats }>;
type AdminRagCacheClearResponse = ApiResponse<{ cache: RagCacheStats }>;
type AdminRagMetricsResponse = ApiResponse<{ metrics: RagMetricsSnapshot }>;
type AdminRagUsageResponse = ApiResponse<{ usage: RagUsageSummary }>;

type AdminRagRouteOptions = {
  config: RagRuntimeConfig;
  ragServices?: RagRuntimeServices | null;
};

export function registerAdminRagRoutes(app: FastifyInstance, options: AdminRagRouteOptions): void {
  app.get<{ Reply: AdminRagHealthResponse | ApiFailure }>(
    "/admin/rag/health",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      const operations = new RagOperationsService({
        cacheService: options.ragServices?.cacheService ?? null,
        config: options.config,
        metricsService: options.ragServices?.metricsService ?? null,
        redisClient: options.ragServices?.redisClient ?? null,
        usageLimitService: options.ragServices?.usageLimitService ?? null,
        vectorStore: options.ragServices?.vectorStore ?? null
      });

      return {
        ok: true,
        data: {
          health: await operations.getHealth()
        }
      };
    }
  );

  app.get<{ Reply: AdminRagDocumentsResponse | ApiFailure }>(
    "/admin/rag/documents",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      const operations = new RagOperationsService({
        cacheService: options.ragServices?.cacheService ?? null,
        config: options.config,
        metricsService: options.ragServices?.metricsService ?? null,
        redisClient: options.ragServices?.redisClient ?? null,
        usageLimitService: options.ragServices?.usageLimitService ?? null,
        vectorStore: options.ragServices?.vectorStore ?? null
      });

      return {
        ok: true,
        data: {
          documents: await operations.listDocuments()
        }
      };
    }
  );

  app.get<{ Reply: AdminRagEvalCasesResponse | ApiFailure }>(
    "/admin/rag/eval/cases",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          cases: ragEvalCases
        }
      };
    }
  );

  app.post<{ Body: unknown; Reply: AdminRagEvalRunResponse | ApiFailure }>(
    "/admin/rag/eval/run",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      const parsedBody = adminRagEvalRunBodySchema.safeParse(request.body ?? {});

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_RAG_EVAL_RUN_REQUEST",
            message: "RAG eval isteği geçersiz."
          }
        });
      }

      const runner = new RagEvalRunner({
        assistantService: options.ragServices?.assistantService ?? null,
        liveEvalEnabled: options.config.enabled ? options.config.liveEvalEnabled : false
      });
      const summary = await runner.run(parsedBody.data);
      await options.ragServices?.metricsService.recordEval(parsedBody.data.mode, parsedBody.data.mode === "live" && summary.results.some((result) => result.issues.includes("live_eval_disabled")));

      if (parsedBody.data.mode === "live" && summary.results.some((result) => result.issues.includes("live_eval_disabled"))) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "RAG_LIVE_EVAL_DISABLED",
            message: "Live eval kapalı. RAG_LIVE_EVAL_ENABLED=true olmadan gerçek eval çalıştırılamaz."
          }
        });
      }

      return {
        ok: true,
        data: summary
      };
    }
  );

  app.get<{ Reply: AdminRagCacheStatsResponse | ApiFailure }>(
    "/admin/rag/cache/stats",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          cache: options.ragServices ? await options.ragServices.cacheService.stats() : disabledCacheStats()
        }
      };
    }
  );

  app.post<{ Reply: AdminRagCacheClearResponse | ApiFailure }>(
    "/admin/rag/cache/clear",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      await options.ragServices?.cacheService.clear();

      return {
        ok: true,
        data: {
          cache: options.ragServices ? await options.ragServices.cacheService.stats() : disabledCacheStats()
        }
      };
    }
  );

  app.get<{ Reply: AdminRagMetricsResponse | ApiFailure }>(
    "/admin/rag/metrics",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          metrics: options.ragServices ? await options.ragServices.metricsService.snapshot() : disabledMetrics()
        }
      };
    }
  );

  app.get<{ Reply: AdminRagUsageResponse | ApiFailure }>(
    "/admin/rag/usage",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          usage: options.ragServices?.usageLimitService.summary() ?? disabledUsage()
        }
      };
    }
  );
}

function disabledCacheStats(): RagCacheStats {
  return {
    enabled: false,
    backend: "disabled",
    backendEffective: "disabled",
    entries: 0,
    hits: 0,
    misses: 0,
    sets: 0,
    clears: 0,
    hitRate: 0
  };
}

function disabledMetrics(): RagMetricsSnapshot {
  return {
    enabled: false,
    backend: "disabled",
    backendEffective: "disabled",
    date: new Date().toISOString().slice(0, 10),
    counters: {},
    byIntent: {},
    byMode: {},
    byTopic: {}
  };
}

function disabledUsage(): RagUsageSummary {
  return {
    enabled: false,
    backend: "disabled",
    backendEffective: "disabled",
    limits: {
      hourlyGuest: 0,
      dailyGuest: 0,
      hourlyUser: 0,
      dailyUser: 0,
      adminBypass: false
    }
  };
}

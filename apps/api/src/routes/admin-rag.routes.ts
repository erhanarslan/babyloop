import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import type { RagRuntimeConfig } from "../config/env.js";
import {
  adminRagEvalRunBodySchema,
  adminRagPlaygroundQueryBodySchema,
  adminRagReindexRunBodySchema
} from "../schemas/admin-rag.schemas.js";
import { requireBackofficePermission } from "../services/admin-context.service.js";
import {
  RagEvalHistoryService,
  type RagEvalHistoryEntry,
  type RagEvalHistoryListItem
} from "../services/rag-eval-history.service.js";
import { RagEvalRunner, type RagEvalRunSummary } from "../services/rag-eval-runner.service.js";
import { ragEvalCases } from "../services/rag-eval-cases.js";
import {
  RagOperationsService,
  type RagDocumentOperationSummary,
  type RagHealthSummary,
  type RagReindexRunResult
} from "../services/rag-operations.service.js";
import { RagPlaygroundService, type RagPlaygroundResponse } from "../services/rag-playground.service.js";
import type {
  RagDocumentChunkPreviewResponse
} from "../services/rag.types.js";
import type { RagCacheStats } from "../services/rag-cache.service.js";
import type { RagReindexCheckSummary } from "../services/rag-knowledge-governance.service.js";
import type { RagMetricsSnapshot } from "../services/rag-metrics.service.js";
import type { RagRuntimeServices } from "../services/rag-runtime.service.js";
import type { RagUsageSummary } from "../services/rag-usage-limits.service.js";

type AdminRagHealthResponse = ApiResponse<{ health: RagHealthSummary }>;
type AdminRagDocumentsResponse = ApiResponse<{ documents: RagDocumentOperationSummary[] }>;
type AdminRagDocumentChunksResponse = ApiResponse<RagDocumentChunkPreviewResponse>;
type AdminRagReindexCheckResponse = ApiResponse<RagReindexCheckSummary>;
type AdminRagEvalCasesResponse = ApiResponse<{ cases: typeof ragEvalCases }>;
type AdminRagEvalRunResponse = ApiResponse<RagEvalRunSummary & { runId: string }>;
type AdminRagEvalHistoryResponse = ApiResponse<{ runs: RagEvalHistoryListItem[] }>;
type AdminRagEvalHistoryDetailResponse = ApiResponse<{ run: RagEvalHistoryEntry }>;
type AdminRagCacheStatsResponse = ApiResponse<{ cache: RagCacheStats }>;
type AdminRagCacheClearResponse = ApiResponse<{ cache: RagCacheStats }>;
type AdminRagMetricsResponse = ApiResponse<{ metrics: RagMetricsSnapshot }>;
type AdminRagUsageResponse = ApiResponse<{ usage: RagUsageSummary }>;
type AdminRagPlaygroundResponse = ApiResponse<RagPlaygroundResponse>;
type AdminRagReindexRunResponse = ApiResponse<RagReindexRunResult>;

type AdminRagRouteOptions = {
  config: RagRuntimeConfig;
  evalHistoryService?: RagEvalHistoryService | null;
  ragServices?: RagRuntimeServices | null;
};

export function registerAdminRagRoutes(app: FastifyInstance, options: AdminRagRouteOptions): void {
  const evalHistory = options.evalHistoryService ?? new RagEvalHistoryService({
    maxRuns: options.config.enabled ? options.config.evalHistoryMaxRuns : 20
  });

  app.post<{ Body: unknown; Reply: AdminRagPlaygroundResponse | ApiFailure }>(
    "/admin/rag/playground/query",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      const parsedBody = adminRagPlaygroundQueryBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_RAG_PLAYGROUND_REQUEST",
            message: "RAG playground isteği geçersiz."
          }
        });
      }

      if (!options.config.enabled || !options.config.playgroundEnabled || !options.ragServices) {
        return reply.status(503).send({
          ok: false,
          error: {
            code: "RAG_PLAYGROUND_UNAVAILABLE",
            message: "RAG playground şu an yapılandırılmadı."
          }
        });
      }

      try {
        const playground = new RagPlaygroundService({
          config: options.config,
          assistantService: options.ragServices.assistantService,
          searchService: options.ragServices.searchService
        });

        return {
          ok: true,
          data: await playground.query(parsedBody.data)
        };
      } catch {
        return reply.status(503).send({
          ok: false,
          error: {
            code: "RAG_PLAYGROUND_UNAVAILABLE",
            message: "RAG playground sorgusu tamamlanamadı."
          }
        });
      }
    }
  );

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

  app.get<{ Params: { documentId: string }; Reply: AdminRagDocumentChunksResponse | ApiFailure }>(
    "/admin/rag/documents/:documentId/chunks",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      if (!isSafeDocumentId(request.params.documentId)) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_RAG_DOCUMENT_ID",
            message: "RAG doküman kimliği geçersiz."
          }
        });
      }

      const operations = new RagOperationsService({
        cacheService: options.ragServices?.cacheService ?? null,
        config: options.config,
        metricsService: options.ragServices?.metricsService ?? null,
        redisClient: options.ragServices?.redisClient ?? null,
        usageLimitService: options.ragServices?.usageLimitService ?? null,
        vectorStore: options.ragServices?.vectorStore ?? null
      });
      const chunks = await operations.getDocumentChunks(request.params.documentId);

      if (!chunks) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "RAG_DOCUMENT_NOT_FOUND",
            message: "RAG dokümanı bulunamadı."
          }
        });
      }

      return {
        ok: true,
        data: chunks
      };
    }
  );

  app.get<{ Reply: AdminRagReindexCheckResponse | ApiFailure }>(
    "/admin/rag/reindex/check",
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
        data: await operations.getReindexCheck()
      };
    }
  );

  app.post<{ Body: unknown; Reply: AdminRagReindexRunResponse | ApiFailure }>(
    "/admin/rag/reindex/run",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      const parsedBody = adminRagReindexRunBodySchema.safeParse(request.body ?? {});

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_RAG_REINDEX_REQUEST",
            message: "RAG reindex isteği geçersiz. Full reindex için REINDEX_RAG onayı gerekir."
          }
        });
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
        data: await operations.runReindexWorkflow({ mode: parsedBody.data.mode })
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
      const historyEntry = evalHistory.record(
        summary,
        parsedBody.data.mode === "live" && summary.results.some((result) => result.issues.includes("live_eval_disabled"))
          ? "failed"
          : "completed"
      );

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
        data: {
          ...summary,
          runId: historyEntry.runId
        }
      };
    }
  );

  app.get<{ Reply: AdminRagEvalHistoryResponse | ApiFailure }>(
    "/admin/rag/eval/history",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          runs: evalHistory.list()
        }
      };
    }
  );

  app.get<{ Params: { runId: string }; Reply: AdminRagEvalHistoryDetailResponse | ApiFailure }>(
    "/admin/rag/eval/history/:runId",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      if (!isSafeRunId(request.params.runId)) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_RAG_EVAL_RUN_ID",
            message: "Eval run kimliği geçersiz."
          }
        });
      }

      const run = evalHistory.get(request.params.runId);

      if (!run) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "RAG_EVAL_RUN_NOT_FOUND",
            message: "Eval run bulunamadı."
          }
        });
      }

      return {
        ok: true,
        data: {
          run
        }
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

function isSafeDocumentId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,120}$/iu.test(value);
}

function isSafeRunId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{7,80}$/iu.test(value);
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

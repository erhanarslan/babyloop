import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import type { RagRuntimeConfig } from "../config/env.js";
import { adminRagEvalRunBodySchema } from "../schemas/admin-rag.schemas.js";
import { requireBackofficePermission } from "../services/admin-context.service.js";
import { RagEvalRunner, type RagEvalRunSummary } from "../services/rag-eval-runner.service.js";
import { ragEvalCases } from "../services/rag-eval-cases.js";
import { RagOperationsService, type RagDocumentOperationSummary, type RagHealthSummary } from "../services/rag-operations.service.js";
import type { RagCacheStats } from "../services/rag-cache.service.js";
import type { RagRuntimeServices } from "../services/rag-runtime.service.js";

type AdminRagHealthResponse = ApiResponse<{ health: RagHealthSummary }>;
type AdminRagDocumentsResponse = ApiResponse<{ documents: RagDocumentOperationSummary[] }>;
type AdminRagEvalCasesResponse = ApiResponse<{ cases: typeof ragEvalCases }>;
type AdminRagEvalRunResponse = ApiResponse<RagEvalRunSummary>;
type AdminRagCacheStatsResponse = ApiResponse<{ cache: RagCacheStats }>;
type AdminRagCacheClearResponse = ApiResponse<{ cache: RagCacheStats }>;

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
        config: options.config,
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
        config: options.config,
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
          cache: options.ragServices?.cacheService.stats() ?? disabledCacheStats()
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

      options.ragServices?.cacheService.clear();

      return {
        ok: true,
        data: {
          cache: options.ragServices?.cacheService.stats() ?? disabledCacheStats()
        }
      };
    }
  );
}

function disabledCacheStats(): RagCacheStats {
  return {
    enabled: false,
    entries: 0,
    hits: 0,
    misses: 0,
    hitRate: 0
  };
}

import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { ragSearchBodySchema } from "../schemas/rag.schemas.js";
import type { RagSearchService } from "../services/rag-search.service.js";
import type { RagUsageLimitService } from "../services/rag-usage-limits.service.js";
import type { RagCacheService } from "../services/rag-cache.service.js";
import type { RagMetricsService } from "../services/rag-metrics.service.js";
import type { RagSearchResult } from "../services/rag.types.js";

type RagSearchResponse = ApiResponse<{
  query: string;
  results: RagSearchResult[];
}>;

type RagRouteOptions = {
  ragCacheService?: RagCacheService | null;
  ragMetricsService?: RagMetricsService | null;
  ragSearchService?: RagSearchService | null;
  ragUsageLimitService?: RagUsageLimitService | null;
};

export function registerRagRoutes(app: FastifyInstance, options: RagRouteOptions = {}): void {
  app.post<{ Body: unknown; Reply: RagSearchResponse | ApiFailure }>(
    "/rag/search",
    async (request, reply) => {
      const parsedBody = ragSearchBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_RAG_SEARCH_REQUEST",
            message: "RAG arama isteği geçersiz."
          }
        });
      }

      const service = options.ragSearchService ?? null;

      if (!service) {
        return reply.status(503).send({
          ok: false,
          error: {
            code: "RAG_UNAVAILABLE",
            message: "RAG arama şu an yapılandırılmadı."
          }
        });
      }

      try {
        await options.ragMetricsService?.recordRequest("search");
        const usage = await options.ragUsageLimitService?.consume({
          authenticated: Boolean(request.currentUser),
          currentUser: request.currentUser,
          identifier: request.ip,
          scope: "rag_search"
        });

        if (usage && !usage.allowed) {
          await options.ragMetricsService?.recordRateLimited();
          if (usage.retryAfterSeconds) {
            reply.header("Retry-After", String(usage.retryAfterSeconds));
          }
          return reply.status(429).send({
            ok: false,
            error: {
              code: "RAG_USAGE_LIMIT_EXCEEDED",
              message: "RAG arama sınırına ulaşıldı. Daha sonra tekrar deneyebilirsin."
            }
          });
        }

        const cacheKey = options.ragCacheService?.buildKey({
          kind: "search",
          intent: "search",
          locale: "tr",
          message: `${parsedBody.data.query}:limit:${parsedBody.data.limit ?? 5}`
        });
        const cachedResults = cacheKey ? await options.ragCacheService?.getSearch(cacheKey) : null;

        if (cachedResults) {
          await options.ragMetricsService?.recordSearchResult({
            cacheHit: true,
            sources: cachedResults.map((result) => result.citation)
          });

          return {
            ok: true,
            data: {
              query: parsedBody.data.query,
              results: cachedResults
            }
          };
        }

        const results = await service.search(parsedBody.data.query, parsedBody.data.limit);
        if (cacheKey) {
          await options.ragCacheService?.setSearch(cacheKey, results);
        }
        await options.ragMetricsService?.recordSearchResult({
          cacheHit: false,
          sources: results.map((result) => result.citation)
        });

        return {
          ok: true,
          data: {
            query: parsedBody.data.query,
            results
          }
        };
      } catch {
        await options.ragMetricsService?.recordError();
        return reply.status(503).send({
          ok: false,
          error: {
            code: "RAG_UNAVAILABLE",
            message: "RAG arama şu an yapılandırılmadı."
          }
        });
      }
    }
  );
}

import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { ragSearchBodySchema } from "../schemas/rag.schemas.js";
import type { RagSearchService } from "../services/rag-search.service.js";
import type { RagSearchResult } from "../services/rag.types.js";

type RagSearchResponse = ApiResponse<{
  query: string;
  results: RagSearchResult[];
}>;

type RagRouteOptions = {
  ragSearchService?: RagSearchService | null;
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
        const results = await service.search(parsedBody.data.query, parsedBody.data.limit);

        return {
          ok: true,
          data: {
            query: parsedBody.data.query,
            results
          }
        };
      } catch {
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

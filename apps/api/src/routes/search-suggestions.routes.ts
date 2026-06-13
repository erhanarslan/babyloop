import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { searchSuggestionsQuerySchema } from "../schemas/search-suggestions.schemas.js";
import {
  listSearchSuggestions,
  type SearchSuggestionResponse
} from "../services/search-suggestions.service.js";

type SearchSuggestionsResponse = ApiResponse<{
  suggestions: SearchSuggestionResponse[];
}>;

export function registerSearchSuggestionRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: Record<string, unknown>; Reply: SearchSuggestionsResponse | ApiFailure }>(
    "/search-suggestions",
    async (request, reply) => {
      const parsedQuery = searchSuggestionsQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Search suggestions query is invalid."
          }
        });
      }

      return {
        ok: true,
        data: {
          suggestions: await listSearchSuggestions(app, parsedQuery.data)
        }
      };
    }
  );
}

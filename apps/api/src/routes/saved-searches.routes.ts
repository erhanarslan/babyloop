import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  createSavedSearchBodySchema,
  savedSearchParamsSchema
} from "../schemas/saved-searches.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  type SavedSearchResponse
} from "../services/saved-searches.service.js";

type SavedSearchesResponse = ApiResponse<{
  savedSearches: SavedSearchResponse[];
}>;

type SavedSearchResponseBody = ApiResponse<{
  savedSearch: SavedSearchResponse;
}>;

type DeleteSavedSearchResponse = ApiResponse<{
  deleted: true;
}>;

export function registerSavedSearchRoutes(app: FastifyInstance): void {
  app.get<{ Reply: SavedSearchesResponse | ApiFailure }>("/saved-searches", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        savedSearches: await listSavedSearches(app, currentUser.profile.id)
      }
    };
  });

  app.post<{ Body: unknown; Reply: SavedSearchResponseBody | ApiFailure }>(
    "/saved-searches",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = createSavedSearchBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_SAVED_SEARCH_REQUEST",
            message: "Saved search request is invalid."
          }
        });
      }

      return reply.status(201).send({
        ok: true,
        data: {
          savedSearch: await createSavedSearch(app, currentUser.profile.id, parsedBody.data)
        }
      });
    }
  );

  app.delete<{
    Params: unknown;
    Reply: DeleteSavedSearchResponse | ApiFailure;
  }>("/saved-searches/:savedSearchId", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = savedSearchParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "INVALID_SAVED_SEARCH_REQUEST",
          message: "Saved search id is invalid."
        }
      });
    }

    const result = await deleteSavedSearch(app, currentUser.profile.id, parsedParams.data.savedSearchId);

    if (result === "not_found") {
      return reply.status(404).send({
        ok: false,
        error: {
          code: "SAVED_SEARCH_NOT_FOUND",
          message: "Saved search was not found."
        }
      });
    }

    return {
      ok: true,
      data: {
        deleted: true
      }
    };
  });
}

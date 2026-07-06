import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  createSavedSearchBodySchema,
  savedSearchParamsSchema,
  updateSavedSearchNotificationsBodySchema
} from "../schemas/saved-searches.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  updateSavedSearchNotifications,
  type SavedSearchResponse
} from "../services/saved-searches.service.js";
import { recordProductEvent } from "../services/product-events.service.js";

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

      const savedSearch = await createSavedSearch(app, currentUser.profile.id, parsedBody.data);

      await recordProductEvent(app, {
        actorProfileId: currentUser.profile.id,
        ...(savedSearch.categoryId ? { categoryId: savedSearch.categoryId } : {}),
        eventType: "saved_search_created",
        savedSearchId: savedSearch.id,
        source: "account_saved_searches"
      }).catch(() => undefined);

      return reply.status(201).send({
        ok: true,
        data: {
          savedSearch
        }
      });
    }
  );


  app.patch<{
    Params: unknown;
    Body: unknown;
    Reply: SavedSearchResponseBody | ApiFailure;
  }>("/saved-searches/:savedSearchId/notifications", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = savedSearchParamsSchema.safeParse(request.params);
    const parsedBody = updateSavedSearchNotificationsBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "INVALID_SAVED_SEARCH_REQUEST",
          message: "Saved search notification request is invalid."
        }
      });
    }

    const result = await updateSavedSearchNotifications(
      app,
      currentUser.profile.id,
      parsedParams.data.savedSearchId,
      parsedBody.data
    );

    if (result === "not_found") {
      return reply.status(404).send({
        ok: false,
        error: {
          code: "SAVED_SEARCH_NOT_FOUND",
          message: "Saved search was not found."
        }
      });
    }

    await recordProductEvent(app, {
      actorProfileId: currentUser.profile.id,
      eventType: "saved_search_deleted",
      savedSearchId: parsedParams.data.savedSearchId,
      source: "account_saved_searches"
    }).catch(() => undefined);

    return {
      ok: true,
      data: {
        savedSearch: result
      }
    };
  });

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

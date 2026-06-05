import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { favoriteBodySchema, favoriteProfileParamsSchema } from "../schemas/favorites.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  addFavorite,
  listFavoritesForProfile,
  removeFavorite,
  type FavoriteActionResult,
  type FavoriteListingResponse
} from "../services/favorites.service.js";

type FavoriteActionResponse = ApiResponse<FavoriteActionResult>;

type FavoritesResponse = ApiResponse<{
  favorites: FavoriteListingResponse[];
}>;

type ProfileParams = {
  profileId: string;
};

export function registerFavoriteRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Reply: FavoriteActionResponse }>("/favorites", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedBody = favoriteBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send(invalidFavoriteRequest());
    }

    const result = await addFavorite(app, currentUser.profile.id, parsedBody.data);

    if (result.status === "invalid_listing") {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "INVALID_LISTING",
          message: "Listing does not exist."
        }
      });
    }

    if (result.status === "inactive_listing") {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "LISTING_NOT_ACTIVE",
          message: "Only active or reserved listings can be favorited."
        }
      });
    }

    if (result.status === "own_listing") {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "CANNOT_FAVORITE_OWN_LISTING",
          message: "You cannot favorite your own listing."
        }
      });
    }

    return reply.status(result.result.created ? 201 : 200).send({
      ok: true,
      data: result.result
    });
  });

  app.delete<{ Body: unknown; Reply: FavoriteActionResponse }>("/favorites", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedBody = favoriteBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send(invalidFavoriteRequest());
    }

    const result = await removeFavorite(app, currentUser.profile.id, parsedBody.data);

    return {
      ok: true,
      data: result
    };
  });

  app.get<{ Reply: FavoritesResponse }>("/favorites", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        favorites: await listFavoritesForProfile(app, currentUser.profile.id)
      }
    };
  });

  app.get<{ Params: ProfileParams; Reply: FavoritesResponse }>(
    "/profiles/:profileId/favorites",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = favoriteProfileParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Profile id must be a valid UUID."
          }
        });
      }

      if (parsedParams.data.profileId !== currentUser.profile.id) {
        return reply.status(403).send({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "You can only view your own favorites."
          }
        });
      }

      return {
        ok: true,
        data: {
          favorites: await listFavoritesForProfile(app, currentUser.profile.id)
        }
      };
    }
  );
}

function invalidFavoriteRequest(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message: "Favorite request body is invalid."
    }
  };
}

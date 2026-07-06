import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  publishNotificationCreated,
  toNotificationCreatedPayload
} from "../realtime/publisher.js";
import { favoriteBodySchema, favoriteProfileParamsSchema } from "../schemas/favorites.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  addFavorite,
  listFavoritesForProfile,
  removeFavorite,
  type FavoriteActionResult,
  type FavoriteListingResponse
} from "../services/favorites.service.js";
import {
  createNotification,
  getUnreadNotificationCount
} from "../services/notifications.service.js";
import { recordProductEvent } from "../services/product-events.service.js";

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

    if (result.result.notificationTarget) {
      const notification = await createNotification(app, {
        recipientProfileId: result.result.notificationTarget.recipientProfileId,
        actorProfileId: null,
        type: "listing_favorited",
        title: "Listing favorited",
        body: "Someone favorited your listing.",
        entityType: "listing",
        entityId: result.result.notificationTarget.listingId,
        metadata: {
          source: "favorite_added"
        }
      });

      if (notification) {
        const unreadCount = await getUnreadNotificationCount(
          app,
          result.result.notificationTarget.recipientProfileId
        );
        await publishNotificationCreated(
          app,
          result.result.notificationTarget.recipientProfileId,
          toNotificationCreatedPayload(notification, unreadCount)
        );
      }
    }

    if (result.result.created) {
      await recordProductEvent(app, {
        actorProfileId: currentUser.profile.id,
        eventType: "favorite_added",
        listingId: parsedBody.data.listingId,
        source: "favorites"
      }).catch(() => undefined);
    }

    const responseData: FavoriteActionResult = {
      favorite: result.result.favorite,
      ...(result.result.created !== undefined ? { created: result.result.created } : {})
    };

    return reply.status(result.result.created ? 201 : 200).send({
      ok: true,
      data: responseData
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

    if (result.removed) {
      await recordProductEvent(app, {
        actorProfileId: currentUser.profile.id,
        eventType: "favorite_removed",
        listingId: parsedBody.data.listingId,
        source: "favorites"
      }).catch(() => undefined);
    }

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

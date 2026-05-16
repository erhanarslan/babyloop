import {
  events,
  favorites,
  listings,
  productCategories
} from "@babyloop/database/schema";
import type { ApiResponse } from "@babyloop/shared";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import { z } from "zod";

const favoriteBodySchema = z
  .object({
    listing_id: z.string().uuid()
  })
  .strict();

type FavoriteBody = z.infer<typeof favoriteBodySchema>;

type FavoriteActionResponse = ApiResponse<{
  favorite: {
    profileId: string;
    listingId: string;
  };
  created?: boolean;
  removed?: boolean;
}>;

type FavoriteListingResponse = {
  id: string;
  title: string;
  price: {
    amount: string;
    currency: string;
  } | null;
  status: string;
  listingType: string;
  condition: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  favoritedAt: string;
};

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

    const validationError = await validateFavoriteReferences(app, parsedBody.data);

    if (validationError) {
      return reply.status(400).send(validationError);
    }

    const created = await app.db.transaction(async (tx) => {
      const [createdFavorite] = await tx
        .insert(favorites)
        .values({
          profileId: currentUser.profile.id,
          listingId: parsedBody.data.listing_id
        })
        .onConflictDoNothing({
          target: [favorites.profileId, favorites.listingId]
        })
        .returning({
          id: favorites.id
        });

      if (createdFavorite) {
        await tx.insert(events).values({
          actorProfileId: currentUser.profile.id,
          eventType: "favorite_added",
          entityType: "listing",
          entityId: parsedBody.data.listing_id,
          metadata: {
            source: "api_manual"
          }
        });
      }

      return Boolean(createdFavorite);
    });

    return reply.status(created ? 201 : 200).send({
      ok: true,
      data: {
        favorite: {
          profileId: currentUser.profile.id,
          listingId: parsedBody.data.listing_id
        },
        created
      }
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

    const removed = await app.db.transaction(async (tx) => {
      const [removedFavorite] = await tx
        .delete(favorites)
        .where(
          and(
            eq(favorites.profileId, currentUser.profile.id),
            eq(favorites.listingId, parsedBody.data.listing_id)
          )
        )
        .returning({
          id: favorites.id
        });

      if (removedFavorite) {
        await tx.insert(events).values({
          actorProfileId: currentUser.profile.id,
          eventType: "favorite_removed",
          entityType: "listing",
          entityId: parsedBody.data.listing_id,
          metadata: {
            source: "api_manual"
          }
        });
      }

      return Boolean(removedFavorite);
    });

    return {
      ok: true,
      data: {
        favorite: {
          profileId: currentUser.profile.id,
          listingId: parsedBody.data.listing_id
        },
        removed
      }
    };
  });

  app.get<{ Reply: FavoritesResponse }>("/favorites", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const favoriteListings = await listFavoritesForProfile(app, currentUser.profile.id);

    return {
      ok: true,
      data: {
        favorites: favoriteListings
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

      const parsedParams = z.object({ profileId: z.string().uuid() }).safeParse(request.params);

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

      const favoriteListings = await listFavoritesForProfile(app, currentUser.profile.id);

      return {
        ok: true,
        data: {
          favorites: favoriteListings
        }
      };
    }
  );
}

async function listFavoritesForProfile(
  app: FastifyInstance,
  profileId: string
): Promise<FavoriteListingResponse[]> {
  const rows = await app.db
    .select({
      favoritedAt: favorites.createdAt,
      listingId: listings.id,
      title: listings.title,
      priceAmount: listings.priceAmount,
      currency: listings.currency,
      status: listings.status,
      listingType: listings.listingType,
      condition: listings.condition,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      categorySlug: productCategories.slug
    })
    .from(favorites)
    .innerJoin(listings, eq(favorites.listingId, listings.id))
    .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
    .where(eq(favorites.profileId, profileId))
    .orderBy(desc(favorites.createdAt));

  return rows.map((row) => ({
    id: row.listingId,
    title: row.title,
    price: buildPrice(row.priceAmount, row.currency),
    status: row.status,
    listingType: row.listingType,
    condition: row.condition,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug
    },
    favoritedAt: row.favoritedAt.toISOString()
  }));
}

async function validateFavoriteReferences(
  app: FastifyInstance,
  body: FavoriteBody
): Promise<ApiResponse<never> | null> {
  const [listing] = await app.db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, body.listing_id))
    .limit(1);

  if (!listing) {
    return {
      ok: false,
      error: {
        code: "INVALID_LISTING",
        message: "Listing does not exist."
      }
    };
  }

  return null;
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

function buildPrice(amount: string | null, currency: string): FavoriteListingResponse["price"] {
  if (amount === null) {
    return null;
  }

  return {
    amount,
    currency
  };
}

async function requireCurrentUser(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<CurrentUser | null> {
  if (typeof app.authenticate !== "function") {
    reply.status(503).send({
      ok: false,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "Authentication is unavailable."
      }
    });
    return null;
  }

  const currentUser = await app.authenticate(request);

  if (!currentUser) {
    reply.status(401).send({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required."
      }
    });
    return null;
  }

  return currentUser;
}
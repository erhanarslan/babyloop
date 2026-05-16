import {
  events,
  favorites,
  listings,
  productCategories
} from "@babyloop/database/schema";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { FavoriteBody } from "../schemas/favorites.schemas.js";
import type { PriceResponse } from "./listings.service.js";

export type FavoriteActionResult = {
  favorite: {
    profileId: string;
    listingId: string;
  };
  created?: boolean;
  removed?: boolean;
};

export type FavoriteListingResponse = {
  id: string;
  title: string;
  price: PriceResponse;
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

export async function addFavorite(
  app: FastifyInstance,
  profileId: string,
  body: FavoriteBody
): Promise<{ status: "added"; result: FavoriteActionResult } | { status: "invalid_listing" }> {
  const listingExists = await validateListingExists(app, body.listing_id);

  if (!listingExists) {
    return { status: "invalid_listing" };
  }

  const created = await app.db.transaction(async (tx) => {
    const [createdFavorite] = await tx
      .insert(favorites)
      .values({
        profileId,
        listingId: body.listing_id
      })
      .onConflictDoNothing({
        target: [favorites.profileId, favorites.listingId]
      })
      .returning({
        id: favorites.id
      });

    if (createdFavorite) {
      await tx.insert(events).values({
        actorProfileId: profileId,
        eventType: "favorite_added",
        entityType: "listing",
        entityId: body.listing_id,
        metadata: {
          source: "api_manual"
        }
      });
    }

    return Boolean(createdFavorite);
  });

  return {
    status: "added",
    result: {
      favorite: {
        profileId,
        listingId: body.listing_id
      },
      created
    }
  };
}

export async function removeFavorite(
  app: FastifyInstance,
  profileId: string,
  body: FavoriteBody
): Promise<FavoriteActionResult> {
  const removed = await app.db.transaction(async (tx) => {
    const [removedFavorite] = await tx
      .delete(favorites)
      .where(and(eq(favorites.profileId, profileId), eq(favorites.listingId, body.listing_id)))
      .returning({
        id: favorites.id
      });

    if (removedFavorite) {
      await tx.insert(events).values({
        actorProfileId: profileId,
        eventType: "favorite_removed",
        entityType: "listing",
        entityId: body.listing_id,
        metadata: {
          source: "api_manual"
        }
      });
    }

    return Boolean(removedFavorite);
  });

  return {
    favorite: {
      profileId,
      listingId: body.listing_id
    },
    removed
  };
}

export async function listFavoritesForProfile(
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

async function validateListingExists(app: FastifyInstance, listingId: string): Promise<boolean> {
  const [listing] = await app.db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  return Boolean(listing);
}

function buildPrice(amount: string | null, currency: string): PriceResponse {
  if (amount === null) {
    return null;
  }

  return {
    amount,
    currency
  };
}


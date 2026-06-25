import {
  events,
  favorites,
  listingImages,
  listings,
  productCategories
} from "@babyloop/database/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { FavoriteBody } from "../schemas/favorites.schemas.js";
import {
  buildPrice,
  type ListingImageResponse,
  type PriceResponse
} from "./listing-response.mapper.js";

const FAVORITE_VISIBLE_LISTING_STATUSES = ["active", "reserved"] as const;

export type FavoriteActionResult = {
  favorite: {
    profileId: string;
    listingId: string;
  };
  created?: boolean;
  notificationTarget?: {
    listingId: string;
    listingTitle: string;
    recipientProfileId: string;
  };
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
  firstImage: ListingImageResponse | null;
  images: ListingImageResponse[];
  favoritedAt: string;
};

export async function addFavorite(
  app: FastifyInstance,
  profileId: string,
  body: FavoriteBody
): Promise<
  | { status: "added"; result: FavoriteActionResult }
  | { status: "inactive_listing" }
  | { status: "invalid_listing" }
  | { status: "own_listing" }
> {
  const listing = await findFavoriteableListing(app, body.listingId);

  if (!listing) {
    return { status: "invalid_listing" };
  }

  if (!isFavoriteVisibleListingStatus(listing.status)) {
    return { status: "inactive_listing" };
  }

  if (listing.sellerProfileId === profileId) {
    return { status: "own_listing" };
  }

  const created = await app.db.transaction(async (tx) => {
    const [createdFavorite] = await tx
      .insert(favorites)
      .values({
        profileId,
        listingId: body.listingId
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
        entityId: body.listingId,
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
        listingId: body.listingId
      },
      created,
      ...(created
        ? {
            notificationTarget: {
              listingId: listing.id,
              listingTitle: listing.title,
              recipientProfileId: listing.sellerProfileId
            }
          }
        : {})
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
      .where(and(eq(favorites.profileId, profileId), eq(favorites.listingId, body.listingId)))
      .returning({
        id: favorites.id
      });

    if (removedFavorite) {
      await tx.insert(events).values({
        actorProfileId: profileId,
        eventType: "favorite_removed",
        entityType: "listing",
        entityId: body.listingId,
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
      listingId: body.listingId
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
    .where(
      and(
        eq(favorites.profileId, profileId),
        inArray(listings.status, [...FAVORITE_VISIBLE_LISTING_STATUSES])
      )
    )
    .orderBy(desc(favorites.createdAt));

  const imagesByListingId = await getFavoriteImagesByListingId(
    app,
    rows.map((row) => row.listingId)
  );

  return rows.map((row) => {
    const images = imagesByListingId.get(row.listingId) ?? [];

    return {
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
      firstImage: images[0] ?? null,
      images,
      favoritedAt: row.favoritedAt.toISOString()
    };
  });
}

async function getFavoriteImagesByListingId(
  app: FastifyInstance,
  listingIds: string[]
): Promise<Map<string, ListingImageResponse[]>> {
  if (listingIds.length === 0) {
    return new Map();
  }

  const imageRows = await app.db
    .select({
      id: listingImages.id,
      listingId: listingImages.listingId,
      url: listingImages.url,
      sortOrder: listingImages.sortOrder
    })
    .from(listingImages)
    .where(
      and(
        inArray(listingImages.listingId, listingIds),
        eq(listingImages.reviewStatus, "approved")
      )
    )
    .orderBy(asc(listingImages.listingId), asc(listingImages.sortOrder));

  const imagesByListingId = new Map<string, ListingImageResponse[]>();

  for (const image of imageRows) {
    const images = imagesByListingId.get(image.listingId) ?? [];

    if (images.length >= 5) {
      continue;
    }

    images.push({
      id: image.id,
      url: image.url,
      sortOrder: image.sortOrder
    });
    imagesByListingId.set(image.listingId, images);
  }

  return imagesByListingId;
}

async function findFavoriteableListing(app: FastifyInstance, listingId: string) {
  const [listing] = await app.db
    .select({
      id: listings.id,
      sellerProfileId: listings.sellerProfileId,
      title: listings.title,
      status: listings.status
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  return listing ?? null;
}

function isFavoriteVisibleListingStatus(status: string): boolean {
  return FAVORITE_VISIBLE_LISTING_STATUSES.some((visibleStatus) => visibleStatus === status);
}

import {
  events,
  listingImages,
  listings,
  productCategories,
  profiles
} from "@babyloop/database/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type { CreateListingBody } from "../schemas/listings.schemas.js";

const LISTING_LIMIT = 20;

export type CategoryBasicResponse = {
  id: string;
  name: string;
  slug: string;
};

export type ListingImageResponse = {
  id: string;
  url: string;
  sortOrder: number;
};

export type PriceResponse = {
  amount: string;
  currency: string;
} | null;

export type ListingSummaryResponse = {
  id: string;
  title: string;
  price: PriceResponse;
  status: string;
  listingType: string;
  condition: string;
  category: CategoryBasicResponse;
  firstImage: ListingImageResponse | null;
  createdAt: string;
};

export type ListingDetailResponse = ListingSummaryResponse & {
  description: string | null;
  images: ListingImageResponse[];
  seller: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    locationCity: string | null;
  };
  updatedAt: string;
};

export async function createListing(
  app: FastifyInstance,
  currentUser: CurrentUser,
  body: CreateListingBody
): Promise<{ status: "created"; listing: ListingSummaryResponse } | { status: "invalid_category" }> {
  const category = await findCategory(app, body.categoryId);

  if (!category) {
    return { status: "invalid_category" };
  }

  const created = await app.db.transaction(async (tx) => {
    const [createdListing] = await tx
      .insert(listings)
      .values({
        sellerProfileId: currentUser.profile.id,
        categoryId: body.categoryId,
        title: body.title,
        description: body.description,
        priceAmount: body.priceAmount,
        currency: body.currency,
        status: "active",
        listingType: body.listingType,
        condition: body.condition
      })
      .returning({
        id: listings.id,
        title: listings.title,
        priceAmount: listings.priceAmount,
        currency: listings.currency,
        status: listings.status,
        listingType: listings.listingType,
        condition: listings.condition,
        createdAt: listings.createdAt
      });

    if (!createdListing) {
      throw new Error("Listing insert failed.");
    }

    const imageValues = body.imageUrls.map((url, index) => ({
      listingId: createdListing.id,
      url,
      sortOrder: index
    }));

    const createdImages = imageValues.length > 0
      ? await tx
        .insert(listingImages)
        .values(imageValues)
        .returning({
          id: listingImages.id,
          url: listingImages.url,
          sortOrder: listingImages.sortOrder
        })
      : [];

    await tx.insert(events).values({
      actorProfileId: currentUser.profile.id,
      eventType: "listing_created",
      entityType: "listing",
      entityId: createdListing.id,
      metadata: {
        source: "api_manual",
        categoryId: body.categoryId,
        listingType: body.listingType,
        hasImages: body.imageUrls.length > 0
      }
    });

    return {
      images: createdImages,
      listing: createdListing
    };
  });

  return {
    status: "created",
    listing: mapListingSummary({
      ...created.listing,
      category,
      firstImage: created.images[0] ?? null
    })
  };
}

export async function listActiveListings(app: FastifyInstance): Promise<ListingSummaryResponse[]> {
  const rows = await app.db
    .select({
      id: listings.id,
      title: listings.title,
      priceAmount: listings.priceAmount,
      currency: listings.currency,
      status: listings.status,
      listingType: listings.listingType,
      condition: listings.condition,
      createdAt: listings.createdAt,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      categorySlug: productCategories.slug
    })
    .from(listings)
    .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
    .where(eq(listings.status, "active"))
    .orderBy(desc(listings.createdAt))
    .limit(LISTING_LIMIT);

  const firstImages = await getFirstImages(
    app,
    rows.map((row) => row.id)
  );

  return rows.map((row) =>
    mapListingSummary({
      ...row,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug
      },
      firstImage: firstImages.get(row.id) ?? null
    })
  );
}

export async function getListingDetail(
  app: FastifyInstance,
  id: string
): Promise<ListingDetailResponse | null> {
  const rows = await app.db
    .select({
      id: listings.id,
      title: listings.title,
      description: listings.description,
      priceAmount: listings.priceAmount,
      currency: listings.currency,
      status: listings.status,
      listingType: listings.listingType,
      condition: listings.condition,
      createdAt: listings.createdAt,
      updatedAt: listings.updatedAt,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      categorySlug: productCategories.slug,
      sellerId: profiles.id,
      sellerDisplayName: profiles.displayName,
      sellerAvatarUrl: profiles.avatarUrl,
      sellerLocationCity: profiles.locationCity
    })
    .from(listings)
    .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
    .innerJoin(profiles, eq(listings.sellerProfileId, profiles.id))
    .where(and(eq(listings.id, id), eq(listings.status, "active")))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  const images = await getImages(app, row.id);

  return {
    ...mapListingSummary({
      ...row,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug
      },
      firstImage: images[0] ?? null
    }),
    description: row.description,
    images,
    seller: {
      id: row.sellerId,
      displayName: row.sellerDisplayName,
      avatarUrl: row.sellerAvatarUrl,
      locationCity: row.sellerLocationCity
    },
    updatedAt: row.updatedAt.toISOString()
  };
}

async function findCategory(
  app: FastifyInstance,
  categoryId: string
): Promise<CategoryBasicResponse | null> {
  const [category] = await app.db
    .select({
      id: productCategories.id,
      name: productCategories.name,
      slug: productCategories.slug
    })
    .from(productCategories)
    .where(eq(productCategories.id, categoryId))
    .limit(1);

  return category ?? null;
}

async function getFirstImages(
  app: FastifyInstance,
  listingIds: string[]
): Promise<Map<string, ListingImageResponse>> {
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
    .where(inArray(listingImages.listingId, listingIds))
    .orderBy(asc(listingImages.listingId), asc(listingImages.sortOrder));

  const firstImages = new Map<string, ListingImageResponse>();

  for (const image of imageRows) {
    if (firstImages.has(image.listingId)) {
      continue;
    }

    firstImages.set(image.listingId, {
      id: image.id,
      url: image.url,
      sortOrder: image.sortOrder
    });
  }

  return firstImages;
}

async function getImages(
  app: FastifyInstance,
  listingId: string
): Promise<ListingImageResponse[]> {
  return app.db
    .select({
      id: listingImages.id,
      url: listingImages.url,
      sortOrder: listingImages.sortOrder
    })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId))
    .orderBy(asc(listingImages.sortOrder));
}

function mapListingSummary(value: {
  id: string;
  title: string;
  priceAmount: string | null;
  currency: string;
  status: string;
  listingType: string;
  condition: string;
  createdAt: Date;
  category: CategoryBasicResponse;
  firstImage: ListingImageResponse | null;
}): ListingSummaryResponse {
  return {
    id: value.id,
    title: value.title,
    price: buildPrice(value.priceAmount, value.currency),
    status: value.status,
    listingType: value.listingType,
    condition: value.condition,
    category: value.category,
    firstImage: value.firstImage,
    createdAt: value.createdAt.toISOString()
  };
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


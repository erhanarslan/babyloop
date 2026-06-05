import {
  listingImages,
  listings,
  productCategories,
  profiles
} from "@babyloop/database/schema";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type {
  CategoryBasicResponse,
  ListingImageResponse
} from "./listing-response.mapper.js";

const LISTING_LIMIT = 20;
const PUBLIC_LISTING_STATUSES: Array<"active" | "reserved"> = ["active", "reserved"];

export async function findCategory(
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

export async function selectActiveListingRows(app: FastifyInstance, searchQuery?: string) {
  const normalizedSearchQuery = searchQuery?.trim() ?? "";
  const shouldSearch = normalizedSearchQuery.length >= 3;
  const searchPattern = `%${normalizedSearchQuery}%`;

  return app.db
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
    .where(
      shouldSearch
        ? and(
          inArray(listings.status, PUBLIC_LISTING_STATUSES),
          or(
            ilike(listings.title, searchPattern),
            ilike(listings.description, searchPattern),
            ilike(productCategories.name, searchPattern)
          )
        )
        : inArray(listings.status, PUBLIC_LISTING_STATUSES)
    )
    .orderBy(desc(listings.createdAt))
    .limit(LISTING_LIMIT);
}

export async function selectListingsBySellerProfileId(app: FastifyInstance, sellerProfileId: string) {
  return app.db
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
    .where(eq(listings.sellerProfileId, sellerProfileId))
    .orderBy(desc(listings.createdAt))
    .limit(LISTING_LIMIT);
}

export async function selectListingDetailRow(app: FastifyInstance, id: string) {
  const [row] = await app.db
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
    .where(and(eq(listings.id, id), inArray(listings.status, PUBLIC_LISTING_STATUSES)))
    .limit(1);

  return row ?? null;
}

export async function selectListingOwnerRow(app: FastifyInstance, id: string) {
  const [row] = await app.db
    .select({
      id: listings.id,
      sellerProfileId: listings.sellerProfileId,
      status: listings.status
    })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);

  return row ?? null;
}

export async function selectListingSummaryRow(app: FastifyInstance, id: string) {
  const [row] = await app.db
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
    .where(eq(listings.id, id))
    .limit(1);

  return row ?? null;
}

export async function getFirstImages(
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

export async function getImages(
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

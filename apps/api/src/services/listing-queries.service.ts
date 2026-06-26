import {
  favorites,
  listingImages,
  listings,
  productCategories,
  profiles
} from "@babyloop/database/schema";
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ListingsQuery } from "../schemas/listings.schemas.js";
import type {
  CategoryBasicResponse,
  ListingImageResponse
} from "./listing-response.mapper.js";

const LISTING_LIMIT = 20;
const PUBLIC_LISTING_STATUSES: Array<"active" | "reserved"> = ["active", "reserved"];

type ActiveListingQueryInput = Partial<ListingsQuery> | string | undefined;

type NormalizedActiveListingQuery = {
  q?: string;
  search?: string;
  categoryId?: string;
  listingType?: ListingsQuery["listingType"];
  condition?: ListingsQuery["condition"];
  priceMin?: string;
  priceMax?: string;
  hasImages?: boolean;
  sort: ListingsQuery["sort"];
  limit: number;
  offset: number;
};

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

export async function selectActiveListingRows(
  app: FastifyInstance,
  query?: ActiveListingQueryInput
) {
  const options = normalizeActiveListingQuery(query);

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
      categorySlug: productCategories.slug,
      sellerLocationCity: profiles.locationCity
    })
    .from(listings)
    .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
    .innerJoin(profiles, eq(listings.sellerProfileId, profiles.id))
    .where(buildActiveListingWhere(options))
    .orderBy(...buildActiveListingOrderBy(options.sort))
    .limit(options.limit)
    .offset(options.offset);
}

export async function countActiveListingRows(
  app: FastifyInstance,
  query?: ActiveListingQueryInput
): Promise<number> {
  const options = normalizeActiveListingQuery(query);

  const [row] = await app.db
    .select({
      total: sql<number>`count(${listings.id})::int`
    })
    .from(listings)
    .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
    .innerJoin(profiles, eq(listings.sellerProfileId, profiles.id))
    .where(buildActiveListingWhere(options));

  return row?.total ?? 0;
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
    .where(
      and(
        eq(listings.id, id),
        inArray(listings.status, PUBLIC_LISTING_STATUSES),
        ne(profiles.safetyStatus, "suspended")
      )
    )
    .limit(1);

  return row ?? null;
}

export async function selectListingOwnerRow(app: FastifyInstance, id: string) {
  const [row] = await app.db
    .select({
      id: listings.id,
      sellerProfileId: listings.sellerProfileId,
      status: listings.status,
      title: listings.title,
      description: listings.description,
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

export async function getPublicListingImagesByListingIds(
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

export async function getPublicListingImages(
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
    .where(
      and(
        eq(listingImages.listingId, listingId),
        eq(listingImages.reviewStatus, "approved")
      )
    )
    .orderBy(asc(listingImages.sortOrder));
}

export async function getOwnerListingImages(
  app: FastifyInstance,
  listingId: string
): Promise<ListingImageResponse[]> {
  return app.db
    .select({
      id: listingImages.id,
      url: listingImages.url,
      sortOrder: listingImages.sortOrder,
      reviewStatus: listingImages.reviewStatus
    })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId))
    .orderBy(asc(listingImages.sortOrder));
}

export async function getFavoriteCounts(
  app: FastifyInstance,
  listingIds: string[]
): Promise<Map<string, number>> {
  if (listingIds.length === 0) {
    return new Map();
  }

  const rows = await app.db
    .select({
      listingId: favorites.listingId,
      favoriteCount: sql<number>`count(${favorites.id})::int`
    })
    .from(favorites)
    .where(inArray(favorites.listingId, listingIds))
    .groupBy(favorites.listingId);

  return new Map(rows.map((row) => [row.listingId, row.favoriteCount]));
}

function normalizeActiveListingQuery(query: ActiveListingQueryInput): NormalizedActiveListingQuery {
  if (typeof query === "string") {
    return {
      q: query,
      sort: "newest",
      limit: LISTING_LIMIT,
      offset: 0
    };
  }

  return {
    ...(query?.q ? { q: query.q } : {}),
    ...(query?.search ? { search: query.search } : {}),
    ...(query?.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query?.listingType ? { listingType: query.listingType } : {}),
    ...(query?.condition ? { condition: query.condition } : {}),
    ...(query?.priceMin ? { priceMin: query.priceMin } : {}),
    ...(query?.priceMax ? { priceMax: query.priceMax } : {}),
    ...(query?.hasImages !== undefined ? { hasImages: query.hasImages } : {}),
    sort: query?.sort ?? "newest",
    limit: query?.limit ?? LISTING_LIMIT,
    offset: query?.offset ?? 0
  };
}

function buildActiveListingWhere(options: NormalizedActiveListingQuery) {
  const normalizedSearchQuery = (options.q ?? options.search ?? "").trim();
  const shouldSearch = normalizedSearchQuery.length >= 3;
  const searchPattern = `%${normalizedSearchQuery}%`;

  return and(
    inArray(listings.status, PUBLIC_LISTING_STATUSES),
    ne(profiles.safetyStatus, "suspended"),
    ...(shouldSearch
      ? [
        or(
          ilike(listings.title, searchPattern),
          ilike(listings.description, searchPattern),
          ilike(productCategories.name, searchPattern)
        )
      ]
      : []),
    ...(options.categoryId ? [eq(listings.categoryId, options.categoryId)] : []),
    ...(options.listingType ? [eq(listings.listingType, options.listingType)] : []),
    ...(options.condition ? [eq(listings.condition, options.condition)] : []),
    ...(options.priceMin ? [sql`${listings.priceAmount} >= ${options.priceMin}`] : []),
    ...(options.priceMax ? [sql`${listings.priceAmount} <= ${options.priceMax}`] : []),
    ...(options.hasImages ? [sql`exists (
      select 1 from listing_images
      where listing_images.listing_id = ${listings.id}
        and listing_images.review_status = 'approved'
    )`] : [])
  );
}

function buildActiveListingOrderBy(sort: ListingsQuery["sort"]) {
  if (sort === "oldest") {
    return [asc(listings.createdAt)];
  }

  if (sort === "price_asc") {
    return [asc(listings.priceAmount), desc(listings.createdAt)];
  }

  if (sort === "price_desc") {
    return [desc(listings.priceAmount), desc(listings.createdAt)];
  }

  return [desc(listings.createdAt)];
}

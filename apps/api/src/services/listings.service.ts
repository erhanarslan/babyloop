import {
  events,
  listingImages,
  listings
} from "@babyloop/database/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type {
  CreateListingBody,
  ListingStatusValue,
  ListingsQuery,
  UpdateListingBody
} from "../schemas/listings.schemas.js";
import { MAX_LISTING_IMAGES, type SafeImage } from "./image-safety.service.js";
import {
  countActiveListingRows,
  findCategory,
  getFavoriteCounts,
  getOwnerListingImages,
  getPublicListingImages,
  getPublicListingImagesByListingIds,
  selectActiveListingRows,
  selectListingsBySellerProfileId,
  selectListingDetailRow,
  selectListingOwnerRow,
  selectListingSummaryRow
} from "./listing-queries.service.js";
import {
  mapListingSummary,
  type ListingDetailResponse,
  type ListingImageResponse,
  type ListingSummaryResponse
} from "./listing-response.mapper.js";
import {
  deleteStoredListingImage,
  storeListingImage,
  type StoredListingImage
} from "./image-storage.service.js";
import { canCreateListing, getProfileSafetyStatus } from "./profile-safety.service.js";
import { analyzeListingImageAuthenticity } from "./listing-image-authenticity.service.js";
import { recordListingImageAuthenticityRun } from "./listing-image-authenticity-run-audit.service.js";

export async function createListing(
  app: FastifyInstance,
  currentUser: CurrentUser,
  body: CreateListingBody
): Promise<
  | { status: "created"; listing: ListingSummaryResponse }
  | { status: "image_urls_not_allowed" | "invalid_category" | "profile_not_allowed" }
> {
  if ("imageUrls" in body) {
    return { status: "image_urls_not_allowed" };
  }

  const safetyStatus = await getProfileSafetyStatus(app, currentUser.profile.id);

  if (!safetyStatus || !canCreateListing(safetyStatus)) {
    return { status: "profile_not_allowed" };
  }

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

    await tx.insert(events).values({
      actorProfileId: currentUser.profile.id,
      eventType: "listing_created",
      entityType: "listing",
      entityId: createdListing.id,
      metadata: {
        source: "api_manual",
        categoryId: body.categoryId,
        listingType: body.listingType,
        hasImages: false
      }
    });

    return {
      images: [],
      listing: createdListing
    };
  });

  return {
    status: "created",
    listing: mapListingSummary({
      ...created.listing,
      category,
      favoriteCount: 0,
      firstImage: created.images[0] ?? null
    })
  };
}

export type ListingPaginationResponse = {
  limit: number;
  offset: number;
  total: number;
  hasNextPage: boolean;
};

export type ListActiveListingsPageResponse = {
  listings: ListingSummaryResponse[];
  pagination: ListingPaginationResponse;
};

export async function listActiveListings(
  app: FastifyInstance,
  searchQuery?: string
): Promise<ListingSummaryResponse[]> {
  const rows = await selectActiveListingRows(app, searchQuery);
  return mapListingRows(app, rows);
}

export async function listActiveListingsPage(
  app: FastifyInstance,
  query: ListingsQuery
): Promise<ListActiveListingsPageResponse> {
  const [rows, total] = await Promise.all([
    selectActiveListingRows(app, query),
    countActiveListingRows(app, query)
  ]);
  const listings = await mapListingRows(app, rows);

  return {
    listings,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total,
      hasNextPage: query.offset + rows.length < total
    }
  };
}

export async function updateListing(
  app: FastifyInstance,
  currentUser: CurrentUser,
  listingId: string,
  body: UpdateListingBody
): Promise<
  | { status: "updated"; listing: ListingSummaryResponse }
  | { status: "image_urls_not_allowed" | "not_found" | "forbidden" | "invalid_category" }
> {
  const listing = await selectListingOwnerRow(app, listingId);

  if (!listing) {
    return { status: "not_found" };
  }

  if (listing.sellerProfileId !== currentUser.profile.id) {
    return { status: "forbidden" };
  }

  if ("imageUrls" in body) {
    return { status: "image_urls_not_allowed" };
  }

  if (body.categoryId) {
    const category = await findCategory(app, body.categoryId);

    if (!category) {
      return { status: "invalid_category" };
    }
  }

  const now = new Date();

  await app.db.transaction(async (tx) => {
    await tx
      .update(listings)
      .set({
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.priceAmount !== undefined ? { priceAmount: body.priceAmount } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.listingType !== undefined ? { listingType: body.listingType } : {}),
        ...(body.condition !== undefined ? { condition: body.condition } : {}),
        updatedAt: now
      })
      .where(eq(listings.id, listingId));

    await tx.insert(events).values({
      actorProfileId: currentUser.profile.id,
      eventType: "listing_updated",
      entityType: "listing",
      entityId: listingId,
      metadata: {
        updatedFields: Object.keys(body)
      }
    });
  });

  return {
    status: "updated",
    listing: await getListingSummary(app, listingId)
  };
}

export async function updateListingStatus(
  app: FastifyInstance,
  currentUser: CurrentUser,
  listingId: string,
  nextStatus: ListingStatusValue
): Promise<
  | { status: "updated"; listing: ListingSummaryResponse }
  | { status: "not_found" | "forbidden" | "invalid_transition" }
> {
  const listing = await selectListingOwnerRow(app, listingId);

  if (!listing) {
    return { status: "not_found" };
  }

  if (listing.sellerProfileId !== currentUser.profile.id) {
    return { status: "forbidden" };
  }

  if (!isAllowedStatusTransition(listing.status, nextStatus)) {
    return { status: "invalid_transition" };
  }

  await app.db.transaction(async (tx) => {
    await tx
      .update(listings)
      .set({
        status: nextStatus,
        updatedAt: new Date()
      })
      .where(eq(listings.id, listingId));

    await tx.insert(events).values({
      actorProfileId: currentUser.profile.id,
      eventType: "listing_status_changed",
      entityType: "listing",
      entityId: listingId,
      metadata: {
        previousStatus: listing.status,
        nextStatus
      }
    });
  });

  return {
    status: "updated",
    listing: await getListingSummary(app, listingId)
  };
}

export async function addListingImage(
  app: FastifyInstance,
  currentUser: CurrentUser,
  input: {
    image: SafeImage;
    listingId: string;
    originalFilename: string;
    uploadRoot: string;
  }
): Promise<
  | { status: "created"; image: ListingImageResponse }
  | {
      status: "authenticity_rejected";
      reason: string;
    }
  | { status: "authenticity_unavailable"; reason: string }
  | { status: "not_found" | "forbidden" | "too_many_images" | "duplicate_image" | "storage_failed" }
> {
  const listing = await selectListingOwnerRow(app, input.listingId);

  if (!listing) {
    return { status: "not_found" };
  }

  if (listing.sellerProfileId !== currentUser.profile.id) {
    return { status: "forbidden" };
  }

  const currentImageCount = await countAllListingImages(app, input.listingId);

  if (currentImageCount >= MAX_LISTING_IMAGES) {
    return { status: "too_many_images" };
  }

  const authenticity = await analyzeListingImageAuthenticity(app, {
    categoryName: listing.categoryName,
    description: listing.description,
    image: input.image,
    listingId: input.listingId,
    originalFilename: input.originalFilename,
    title: listing.title
  });

  await recordListingImageAuthenticityRun(app, {
    categoryName: listing.categoryName,
    image: input.image,
    listingId: input.listingId,
    originalFilename: input.originalFilename,
    result: authenticity
  });

  if (authenticity.status === "unavailable") {
    return {
      status: "authenticity_unavailable",
      reason: authenticity.reason
    };
  }

  if (authenticity.decision === "reject") {
    return {
      status: "authenticity_rejected",
      reason: authenticity.reasons[0] ?? "Listing image authenticity check rejected the image."
    };
  }

  const reviewStatus = authenticity.decision === "needs_review" ? "needs_review" : "approved";
  const authenticityCheckedAt = new Date();

  let storedImage: StoredListingImage | null = null;

  try {
    storedImage = await storeListingImage({
      image: input.image,
      listingId: input.listingId,
      uploadRoot: input.uploadRoot
    });

    const duplicateImage = await findListingImageByContentHash(app, input.listingId, storedImage.contentHash);

    if (duplicateImage) {
      await deleteStoredListingImage({
        uploadRoot: input.uploadRoot,
        url: storedImage.url
      }).catch(() => undefined);

      return { status: "duplicate_image" };
    }

    const [createdImage] = await app.db
      .insert(listingImages)
      .values({
        listingId: input.listingId,
        url: storedImage.url,
        contentHash: storedImage.contentHash,
        sortOrder: currentImageCount,
        reviewStatus,
        authenticityProvider: authenticity.providerName,
        authenticityModel: authenticity.modelName,
        authenticityPromptVersion: authenticity.promptVersion,
        authenticityDecision: authenticity.decision,
        authenticityConfidence: authenticity.confidence.toFixed(4),
        authenticityReasons: authenticity.reasons,
        authenticityFlags: authenticity.flags,
        authenticityCheckedAt
      })
      .returning({
        id: listingImages.id,
        url: listingImages.url,
        sortOrder: listingImages.sortOrder,
        reviewStatus: listingImages.reviewStatus
      });

    if (!createdImage) {
      throw new Error("Listing image insert failed.");
    }

    await app.db
      .update(listings)
      .set({ updatedAt: new Date() })
      .where(eq(listings.id, input.listingId));

    return {
      status: "created",
      image: createdImage
    };
  } catch (error) {
    if (storedImage) {
      await deleteStoredListingImage({
        uploadRoot: input.uploadRoot,
        url: storedImage.url
      }).catch(() => undefined);
    }

    if (isListingImageContentHashUniqueViolation(error)) {
      return { status: "duplicate_image" };
    }

    app.log.error(error);
    return { status: "storage_failed" };
  }
}

export async function deleteListingImage(
  app: FastifyInstance,
  currentUser: CurrentUser,
  input: {
    imageId: string;
    listingId: string;
    uploadRoot: string;
  }
): Promise<{ status: "deleted" } | { status: "not_found" | "forbidden" }> {
  const listing = await selectListingOwnerRow(app, input.listingId);

  if (!listing) {
    return { status: "not_found" };
  }

  if (listing.sellerProfileId !== currentUser.profile.id) {
    return { status: "forbidden" };
  }

  const [image] = await app.db
    .select({
      id: listingImages.id,
      url: listingImages.url
    })
    .from(listingImages)
    .where(and(eq(listingImages.id, input.imageId), eq(listingImages.listingId, input.listingId)))
    .limit(1);

  if (!image) {
    return { status: "not_found" };
  }

  await app.db.transaction(async (tx) => {
    await tx.delete(listingImages).where(eq(listingImages.id, input.imageId));

    const remainingImages = await tx
      .select({ id: listingImages.id })
      .from(listingImages)
      .where(eq(listingImages.listingId, input.listingId))
      .orderBy(asc(listingImages.sortOrder), asc(listingImages.createdAt));

    for (const [index, remainingImage] of remainingImages.entries()) {
      await tx
        .update(listingImages)
        .set({ sortOrder: index })
        .where(eq(listingImages.id, remainingImage.id));
    }

    await tx
      .update(listings)
      .set({ updatedAt: new Date() })
      .where(eq(listings.id, input.listingId));
  });

  await deleteStoredListingImage({
    uploadRoot: input.uploadRoot,
    url: image.url
  }).catch((error) => app.log.warn(error));

  return { status: "deleted" };
}

export async function reorderListingImages(
  app: FastifyInstance,
  currentUser: CurrentUser,
  listingId: string,
  imageIds: string[]
): Promise<
  | { status: "updated"; images: ListingImageResponse[] }
  | { status: "not_found" | "forbidden" | "invalid_request" }
> {
  const listing = await selectListingOwnerRow(app, listingId);

  if (!listing) {
    return { status: "not_found" };
  }

  if (listing.sellerProfileId !== currentUser.profile.id) {
    return { status: "forbidden" };
  }

  const currentImages = await getOwnerListingImages(app, listingId);

  if (
    currentImages.length !== imageIds.length ||
    new Set(imageIds).size !== imageIds.length ||
    !currentImages.every((image) => imageIds.includes(image.id))
  ) {
    return { status: "invalid_request" };
  }

  if (imageIds.length === 0) {
    return { status: "updated", images: [] };
  }

  await app.db.transaction(async (tx) => {
    for (const [index, imageId] of imageIds.entries()) {
      await tx
        .update(listingImages)
        .set({ sortOrder: index })
        .where(and(eq(listingImages.id, imageId), eq(listingImages.listingId, listingId)));
    }

    await tx
      .update(listings)
      .set({ updatedAt: new Date() })
      .where(eq(listings.id, listingId));
  });

  return {
    status: "updated",
    images: await getOwnerListingImages(app, listingId)
  };
}

async function findListingImageByContentHash(
  app: FastifyInstance,
  listingId: string,
  contentHash: string
): Promise<{ id: string } | null> {
  const [image] = await app.db
    .select({
      id: listingImages.id
    })
    .from(listingImages)
    .where(and(eq(listingImages.listingId, listingId), eq(listingImages.contentHash, contentHash)))
    .limit(1);

  return image ?? null;
}

function isListingImageContentHashUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as { constraint?: unknown; code?: unknown };

  return (
    maybeError.code === "23505" &&
    typeof maybeError.constraint === "string" &&
    maybeError.constraint.includes("listing_images_listing_content_hash_unique")
  );
}

async function countAllListingImages(
  app: FastifyInstance,
  listingId: string
): Promise<number> {
  const [row] = await app.db
    .select({
      imageCount: sql<number>`count(${listingImages.id})::int`
    })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId));

  return row?.imageCount ?? 0;
}

export async function listListingsForCurrentUser(
  app: FastifyInstance,
  currentUser: CurrentUser
): Promise<ListingSummaryResponse[]> {
  const rows = await selectListingsBySellerProfileId(app, currentUser.profile.id);
  return mapListingRows(app, rows);
}

async function mapListingRows(
  app: FastifyInstance,
  rows: Array<{
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    condition: string;
    createdAt: Date;
    currency: string;
    id: string;
    listingType: string;
    priceAmount: string | null;
    status: string;
    title: string;
  }>
): Promise<ListingSummaryResponse[]> {
  const listingIds = rows.map((row) => row.id);
  const [imagesByListingId, favoriteCounts] = await Promise.all([
    getPublicListingImagesByListingIds(app, listingIds),
    getFavoriteCounts(app, listingIds)
  ]);

  return rows.map((row) =>
    mapListingSummary({
      ...row,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug
      },
      favoriteCount: favoriteCounts.get(row.id) ?? 0,
      firstImage: imagesByListingId.get(row.id)?.[0] ?? null,
      images: imagesByListingId.get(row.id) ?? []
    })
  );
}

async function getListingSummary(
  app: FastifyInstance,
  listingId: string
): Promise<ListingSummaryResponse> {
  const row = await selectListingSummaryRow(app, listingId);

  if (!row) {
    throw new Error("Listing summary lookup failed.");
  }

  const [images, favoriteCounts] = await Promise.all([
    getPublicListingImages(app, row.id),
    getFavoriteCounts(app, [row.id])
  ]);

  return mapListingSummary({
    ...row,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug
    },
    favoriteCount: favoriteCounts.get(row.id) ?? 0,
    firstImage: images[0] ?? null,
    images
  });
}

function isAllowedStatusTransition(currentStatus: string, nextStatus: ListingStatusValue): boolean {
  if (currentStatus === nextStatus) {
    return true;
  }

  const allowedTransitions: Record<string, ListingStatusValue[]> = {
    draft: ["active", "archived"],
    active: ["reserved", "sold", "archived"],
    reserved: ["active", "sold", "archived"],
    sold: ["archived"],
    archived: ["active"]
  };

  return allowedTransitions[currentStatus]?.includes(nextStatus) ?? false;
}

export async function getListingDetail(
  app: FastifyInstance,
  id: string
): Promise<ListingDetailResponse | null> {
  const row = await selectListingDetailRow(app, id);

  if (!row) {
    return null;
  }

  const [images, favoriteCounts] = await Promise.all([
    getPublicListingImages(app, row.id),
    getFavoriteCounts(app, [row.id])
  ]);

  return {
    ...mapListingSummary({
      ...row,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug
      },
      favoriteCount: favoriteCounts.get(row.id) ?? 0,
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

import {
  events,
  listingImages,
  listings
} from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type {
  CreateListingBody,
  ListingStatusValue,
  UpdateListingBody
} from "../schemas/listings.schemas.js";
import {
  findCategory,
  getFavoriteCounts,
  getFirstImages,
  getImages,
  selectActiveListingRows,
  selectListingsBySellerProfileId,
  selectListingDetailRow,
  selectListingOwnerRow,
  selectListingSummaryRow
} from "./listing-queries.service.js";
import {
  mapListingSummary,
  type ListingDetailResponse,
  type ListingSummaryResponse
} from "./listing-response.mapper.js";

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
      favoriteCount: 0,
      firstImage: created.images[0] ?? null
    })
  };
}

export async function listActiveListings(
  app: FastifyInstance,
  searchQuery?: string
): Promise<ListingSummaryResponse[]> {
  const rows = await selectActiveListingRows(app, searchQuery);
  return mapListingRows(app, rows);
}

export async function updateListing(
  app: FastifyInstance,
  currentUser: CurrentUser,
  listingId: string,
  body: UpdateListingBody
): Promise<
  | { status: "updated"; listing: ListingSummaryResponse }
  | { status: "not_found" | "forbidden" | "invalid_category" }
> {
  const listing = await selectListingOwnerRow(app, listingId);

  if (!listing) {
    return { status: "not_found" };
  }

  if (listing.sellerProfileId !== currentUser.profile.id) {
    return { status: "forbidden" };
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

    if (body.imageUrls !== undefined) {
      await tx.delete(listingImages).where(eq(listingImages.listingId, listingId));

      if (body.imageUrls.length > 0) {
        await tx.insert(listingImages).values(
          body.imageUrls.map((url, index) => ({
            listingId,
            url,
            sortOrder: index
          }))
        );
      }
    }

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
  const [firstImages, favoriteCounts] = await Promise.all([
    getFirstImages(
      app,
      listingIds
    ),
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
      firstImage: firstImages.get(row.id) ?? null
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
    getImages(app, row.id),
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
    firstImage: images[0] ?? null
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
    getImages(app, row.id),
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

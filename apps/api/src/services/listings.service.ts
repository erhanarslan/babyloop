import {
  events,
  listingImages,
  listings
} from "@babyloop/database/schema";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type { CreateListingBody } from "../schemas/listings.schemas.js";
import {
  findCategory,
  getFirstImages,
  getImages,
  selectActiveListingRows,
  selectListingDetailRow
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
      firstImage: created.images[0] ?? null
    })
  };
}

export async function listActiveListings(app: FastifyInstance): Promise<ListingSummaryResponse[]> {
  const rows = await selectActiveListingRows(app);
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
  const row = await selectListingDetailRow(app, id);

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

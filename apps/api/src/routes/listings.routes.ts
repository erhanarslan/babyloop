import {
  events,
  listingImages,
  listings,
  productCategories,
  profiles
} from "@babyloop/database/schema";
import type { ApiResponse } from "@babyloop/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const LISTING_LIMIT = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_PRICE_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
// Temporary local seller until authentication provides the seller profile id.
const LOCAL_DEV_SELLER_PROFILE_ID = "10000000-0000-4000-8000-000000000001";

const createListingBodySchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().trim().min(4).max(160),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  priceAmount: z
    .union([z.literal(""), z.string().trim().regex(DECIMAL_PRICE_PATTERN)])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  currency: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => CURRENCY_PATTERN.test(value), "Currency must be a 3-letter code.")
    .optional()
    .default("TRY"),
  listingType: z.enum(["sale", "swap", "donation", "rent"]),
  condition: z.enum(["new", "like_new", "good", "fair", "needs_repair"]),
  imageUrls: z.array(z.string().trim().url().max(1000)).max(5).optional().default([])
}).strict();

type CategoryBasicResponse = {
  id: string;
  name: string;
  slug: string;
};

type ListingImageResponse = {
  id: string;
  url: string;
  sortOrder: number;
};

type ListingSummaryResponse = {
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

type ListingDetailResponse = ListingSummaryResponse & {
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

type PriceResponse = {
  amount: string;
  currency: string;
} | null;

type ListingsResponse = ApiResponse<{
  listings: ListingSummaryResponse[];
}>;

type CreateListingResponse = ApiResponse<{
  listing: ListingSummaryResponse;
}>;

type ListingDetailApiResponse = ApiResponse<{
  listing: ListingDetailResponse;
}>;

type ListingParams = {
  id: string;
};

export function registerListingRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Reply: CreateListingResponse }>("/listings", async (request, reply) => {
    const parsedBody = createListingBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Listing request body is invalid."
        }
      });
    }

    const body = parsedBody.data;

    const [category] = await app.db
      .select({
        id: productCategories.id,
        name: productCategories.name,
        slug: productCategories.slug
      })
      .from(productCategories)
      .where(eq(productCategories.id, body.categoryId))
      .limit(1);

    if (!category) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "INVALID_CATEGORY",
          message: "Category does not exist."
        }
      });
    }

    const [seller] = await app.db
      .select({
        id: profiles.id
      })
      .from(profiles)
      .where(eq(profiles.id, LOCAL_DEV_SELLER_PROFILE_ID))
      .limit(1);

    if (!seller) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "INVALID_SELLER_PROFILE",
          message: "Seller profile does not exist."
        }
      });
    }

    const created = await app.db.transaction(async (tx) => {
      const [createdListing] = await tx
        .insert(listings)
        .values({
          sellerProfileId: LOCAL_DEV_SELLER_PROFILE_ID,
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
        actorProfileId: LOCAL_DEV_SELLER_PROFILE_ID,
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
        listing: createdListing,
        images: createdImages
      };
    });

    const firstImage = created.images[0] ?? null;

    return reply.status(201).send({
      ok: true,
      data: {
        listing: {
          id: created.listing.id,
          title: created.listing.title,
          price: buildPrice(created.listing.priceAmount, created.listing.currency),
          status: created.listing.status,
          listingType: created.listing.listingType,
          condition: created.listing.condition,
          category,
          firstImage,
          createdAt: created.listing.createdAt.toISOString()
        }
      }
    });
  });

  app.get<{ Reply: ListingsResponse }>("/listings", async () => {
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

    return {
      ok: true,
      data: {
        listings: rows.map((row) => ({
          id: row.id,
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
          firstImage: firstImages.get(row.id) ?? null,
          createdAt: row.createdAt.toISOString()
        }))
      }
    };
  });

  app.get<{ Params: ListingParams; Reply: ListingDetailApiResponse }>(
    "/listings/:id",
    async (request, reply) => {
      const { id } = request.params;

      if (!isUuid(id)) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Listing id must be a valid UUID."
          }
        });
      }

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
        return reply.status(404).send({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Listing was not found."
          }
        });
      }

      const images = await getImages(app, row.id);
      const firstImage = images[0] ?? null;

      return {
        ok: true,
        data: {
          listing: {
            id: row.id,
            title: row.title,
            description: row.description,
            price: buildPrice(row.priceAmount, row.currency),
            status: row.status,
            listingType: row.listingType,
            condition: row.condition,
            category: {
              id: row.categoryId,
              name: row.categoryName,
              slug: row.categorySlug
            },
            firstImage,
            images,
            seller: {
              id: row.sellerId,
              displayName: row.sellerDisplayName,
              avatarUrl: row.sellerAvatarUrl,
              locationCity: row.sellerLocationCity
            },
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString()
          }
        }
      };
    }
  );
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

function buildPrice(amount: string | null, currency: string): PriceResponse {
  if (amount === null) {
    return null;
  }

  return {
    amount,
    currency
  };
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

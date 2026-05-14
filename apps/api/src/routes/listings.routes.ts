import {
  listingImages,
  listings,
  productCategories,
  profiles
} from "@babyloop/database/schema";
import type { ApiResponse } from "@babyloop/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

const LISTING_LIMIT = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

type ListingDetailApiResponse = ApiResponse<{
  listing: ListingDetailResponse;
}>;

type ListingParams = {
  id: string;
};

export function registerListingRoutes(app: FastifyInstance): void {
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

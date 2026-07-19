import {
  listingImages,
  listings,
  productCategories,
  profiles
} from "@babyloop/database/schema";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql
} from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  getFavoriteCounts,
  getPublicListingImagesByListingIds
} from "./listing-queries.service.js";
import {
  mapListingSummary,
  type ListingSummaryResponse
} from "./listing-response.mapper.js";

const DEFAULT_CHILD_MATCHED_LISTING_LIMIT = 8;

export async function listAgeMatchedListingsForChild(
  app: FastifyInstance,
  input: {
    ageMonths: number | null;
    viewerProfileId: string;
    limit?: number;
  }
): Promise<ListingSummaryResponse[]> {
  const ageMonths = input.ageMonths;
  const agePredicate =
    ageMonths === null
      ? and(
          isNull(listings.recommendedAgeMinMonths),
          isNull(listings.recommendedAgeMaxMonths)
        )
      : or(
          and(
            isNotNull(listings.recommendedAgeMinMonths),
            isNotNull(listings.recommendedAgeMaxMonths),
            lte(listings.recommendedAgeMinMonths, ageMonths),
            gte(listings.recommendedAgeMaxMonths, ageMonths)
          ),
          and(
            isNull(listings.recommendedAgeMinMonths),
            isNull(listings.recommendedAgeMaxMonths)
          )
        );

  const rows = await app.db
    .select({
      id: listings.id,
      title: listings.title,
      priceAmount: listings.priceAmount,
      currency: listings.currency,
      status: listings.status,
      publicationState: listings.publicationState,
      publishAfter: listings.publishAfter,
      publishedAt: listings.publishedAt,
      publicationReviewReason: listings.publicationReviewReason,
      listingType: listings.listingType,
      condition: listings.condition,
      recommendedAgeMinMonths: listings.recommendedAgeMinMonths,
      recommendedAgeMaxMonths: listings.recommendedAgeMaxMonths,
      createdAt: listings.createdAt,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      categorySlug: productCategories.slug
    })
    .from(listings)
    .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
    .innerJoin(profiles, eq(listings.sellerProfileId, profiles.id))
    .where(
      and(
        eq(listings.status, "active"),
        eq(listings.publicationState, "published"),
        isNotNull(listings.publishedAt),
        ne(listings.sellerProfileId, input.viewerProfileId),
        ne(profiles.safetyStatus, "suspended"),
        agePredicate,
        sql`exists (
          select 1
          from ${listingImages}
          where ${listingImages.listingId} = ${listings.id}
            and ${listingImages.reviewStatus} = 'approved'
        )`
      )
    )
    .orderBy(
      sql`case when ${listings.recommendedAgeMinMonths} is null then 1 else 0 end`,
      desc(listings.publishedAt),
      asc(listings.id)
    )
    .limit(input.limit ?? DEFAULT_CHILD_MATCHED_LISTING_LIMIT);

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

import type { FastifyInstance } from "fastify";
import type { ListingRecommendationsQuery } from "../schemas/listing-recommendations.schemas.js";
import {
  getListingDetail,
  listActiveListingsPage
} from "./listings.service.js";
import type { ListingSummaryResponse } from "./listing-response.mapper.js";

export type ListingRecommendationsResult =
  | {
      status: "listed";
      recommendations: ListingSummaryResponse[];
    }
  | {
      status: "not_found";
    };

export async function listListingRecommendations(
  app: FastifyInstance,
  listingId: string,
  query: ListingRecommendationsQuery
): Promise<ListingRecommendationsResult> {
  const listing = await getListingDetail(app, listingId);

  if (!listing) {
    return {
      status: "not_found"
    };
  }

  const recommendations: ListingSummaryResponse[] = [];
  const seenListingIds = new Set<string>([listingId]);

  const sameCategoryPage = await listActiveListingsPage(app, {
    categoryId: listing.category.id,
    hasImages: true,
    includeTotal: false,
    imageLimit: 3,
    limit: query.limit + 1,
    offset: 0,
    sort: "newest"
  });

  appendUniqueRecommendations(recommendations, seenListingIds, sameCategoryPage.listings, query.limit);

  if (recommendations.length < query.limit) {
    const fallbackPage = await listActiveListingsPage(app, {
      hasImages: true,
      includeTotal: false,
    imageLimit: 3,
      limit: query.limit + 1,
      offset: 0,
      sort: "newest"
    });

    appendUniqueRecommendations(recommendations, seenListingIds, fallbackPage.listings, query.limit);
  }

  return {
    status: "listed",
    recommendations
  };
}

function appendUniqueRecommendations(
  recommendations: ListingSummaryResponse[],
  seenListingIds: Set<string>,
  candidates: ListingSummaryResponse[],
  limit: number
): void {
  for (const candidate of candidates) {
    if (recommendations.length >= limit) {
      return;
    }

    if (seenListingIds.has(candidate.id)) {
      continue;
    }

    seenListingIds.add(candidate.id);
    recommendations.push(candidate);
  }
}

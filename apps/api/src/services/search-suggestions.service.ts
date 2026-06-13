import {
  listings,
  productCategories,
  profiles
} from "@babyloop/database/schema";
import { and, asc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { SearchSuggestionsQuery } from "../schemas/search-suggestions.schemas.js";

const MIN_SEARCH_SUGGESTION_QUERY_LENGTH = 2;
const PUBLIC_LISTING_STATUSES: Array<"active" | "reserved"> = ["active", "reserved"];

export type SearchSuggestionResponse = {
  kind: "category" | "listing";
  label: string;
  categoryId?: string;
  categorySlug?: string;
  listingId?: string;
};

export async function listSearchSuggestions(
  app: FastifyInstance,
  query: SearchSuggestionsQuery
): Promise<SearchSuggestionResponse[]> {
  const normalizedQuery = query.q.trim();

  if (normalizedQuery.length < MIN_SEARCH_SUGGESTION_QUERY_LENGTH) {
    return [];
  }

  const searchPattern = `%${normalizedQuery}%`;
  const categoryRows = await app.db
    .select({
      id: productCategories.id,
      name: productCategories.name,
      slug: productCategories.slug
    })
    .from(productCategories)
    .where(
      or(
        ilike(productCategories.name, searchPattern),
        ilike(productCategories.slug, searchPattern)
      )
    )
    .orderBy(asc(productCategories.name))
    .limit(query.limit);

  const remainingLimit = Math.max(0, query.limit - categoryRows.length);
  const listingRows = remainingLimit > 0
    ? await app.db
      .select({
        id: listings.id,
        title: listings.title,
        categoryId: productCategories.id,
        categorySlug: productCategories.slug
      })
      .from(listings)
      .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
      .innerJoin(profiles, eq(listings.sellerProfileId, profiles.id))
      .where(
        and(
          inArray(listings.status, PUBLIC_LISTING_STATUSES),
          ne(profiles.safetyStatus, "suspended"),
          ilike(listings.title, searchPattern)
        )
      )
      .orderBy(asc(listings.title))
      .limit(remainingLimit)
    : [];

  const suggestions: SearchSuggestionResponse[] = [];
  const seenLabels = new Set<string>();

  for (const category of categoryRows) {
    appendSuggestion(suggestions, seenLabels, {
      kind: "category",
      label: category.name,
      categoryId: category.id,
      categorySlug: category.slug
    });
  }

  for (const listing of listingRows) {
    appendSuggestion(suggestions, seenLabels, {
      kind: "listing",
      label: listing.title,
      categoryId: listing.categoryId,
      categorySlug: listing.categorySlug,
      listingId: listing.id
    });
  }

  return suggestions;
}

function appendSuggestion(
  suggestions: SearchSuggestionResponse[],
  seenLabels: Set<string>,
  suggestion: SearchSuggestionResponse
): void {
  const normalizedLabel = suggestion.label.trim().toLocaleLowerCase();

  if (normalizedLabel.length === 0 || seenLabels.has(normalizedLabel)) {
    return;
  }

  seenLabels.add(normalizedLabel);
  suggestions.push(suggestion);
}

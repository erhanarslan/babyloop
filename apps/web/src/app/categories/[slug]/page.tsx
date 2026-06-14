import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "../../../components/ui";
import {
  buildListingsPath,
  resolveBrowseFilters,
  type BrowseSearchParams
} from "../../../features/listings/browse-routing";
import { BrowsePageContent } from "../../../features/listings/browse-page-content";
import {
  fetchApi,
  getApiBaseUrl,
  type CategoriesPayload,
  type ListingsPagination,
  type ListingsPayload,
  type SearchSuggestionsPayload
} from "../../../lib/api";
import {
  buildCategoryMetadata,
  buildFilteredBrowseNoIndexMetadata,
  buildNoIndexMetadata
} from "../../../lib/seo";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<BrowseSearchParams>;
};

export async function generateMetadata({
  params,
  searchParams
}: CategoryPageProps): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const categoriesResult = await fetchApi<CategoriesPayload>("/api/v1/categories");
  const category = categoriesResult.ok
    ? categoriesResult.data.categories.find((item) => item.slug === slug)
    : null;

  if (!category) {
    return buildNoIndexMetadata(
      "BabyLoop category",
      "This BabyLoop category could not be found."
    );
  }

  if (hasCategorySeoFilters(await searchParams)) {
    return buildFilteredBrowseNoIndexMetadata(`${category.name} filtered listings`);
  }

  return buildCategoryMetadata(category);
}

export default async function CategoryPage({
  params,
  searchParams
}: CategoryPageProps) {
  const slug = decodeURIComponent((await params).slug);
  const resolvedSearchParams = await searchParams;
  const categoriesResult = await fetchApi<CategoriesPayload>("/api/v1/categories");
  const categories = categoriesResult.ok ? categoriesResult.data.categories : [];
  const category = categories.find((item) => item.slug === slug);

  if (!category) {
    notFound();
  }

  const filters = resolveBrowseFilters(resolvedSearchParams, {
    categoryId: category.id
  });
  const listingsPath = buildListingsPath(filters);
  const suggestionsPath = buildSearchSuggestionsPath(filters.q);

  const [listingsResult, suggestionsResult] = await Promise.all([
    fetchApi<ListingsPayload>(listingsPath),
    suggestionsPath ? fetchApi<SearchSuggestionsPayload>(suggestionsPath) : Promise.resolve(null)
  ]);

  const listings = listingsResult.ok ? listingsResult.data.listings : [];
  const searchSuggestions = suggestionsResult?.ok ? suggestionsResult.data.suggestions : [];
  const fallbackPagination: ListingsPagination = {
    limit: filters.limit,
    offset: filters.offset,
    total: listings.length,
    hasNextPage: false
  };
  const pagination = listingsResult.ok
    ? listingsResult.data.pagination ?? fallbackPagination
    : fallbackPagination;
  const error = !listingsResult.ok
    ? listingsResult.error
    : !categoriesResult.ok
      ? categoriesResult.error
      : null;

  return (
    <SiteShell>
      <BrowsePageContent
        apiBaseUrl={getApiBaseUrl()}
        categories={categories}
        currentCategorySlug={category.slug}
        error={error}
        filters={filters}
        listings={listings}
        pagination={pagination}
        searchQuery={filters.q}
        searchSuggestions={searchSuggestions}
      />
    </SiteShell>
  );
}

function buildSearchSuggestionsPath(query: string): string | null {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return null;
  }

  const params = new URLSearchParams({
    limit: "8",
    q: normalizedQuery
  });

  return `/api/v1/search-suggestions?${params.toString()}`;
}

function hasCategorySeoFilters(searchParams: BrowseSearchParams): boolean {
  if (!searchParams) {
    return false;
  }

  return [
    searchParams.q,
    searchParams.condition,
    searchParams.listingType,
    searchParams.priceMin,
    searchParams.priceMax,
    searchParams.hasImages,
    searchParams.offset
  ].some((value) => readSeoParam(value).trim().length > 0);
}

function readSeoParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

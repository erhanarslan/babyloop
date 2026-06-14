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
  type Category,
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
  params?: Promise<{
    slug?: string;
  }>;
  searchParams?: Promise<BrowseSearchParams>;
};

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const slug = decodeURIComponent((await params)?.slug ?? "");
  const category = await findCategoryBySlug(slug);

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

export default async function CategoryLandingPage({ params, searchParams }: CategoryPageProps) {
  const slug = decodeURIComponent((await params)?.slug ?? "");
  const resolvedSearchParams = await searchParams;
  const categoriesResult = await fetchApi<CategoriesPayload>("/api/v1/categories");
  const categories = categoriesResult.ok ? categoriesResult.data.categories : [];
  const category = categories.find((candidate) => candidate.slug === slug) ?? null;

  if (categoriesResult.ok && !category) {
    notFound();
  }

  const filters = resolveBrowseFilters(resolvedSearchParams, {
    categoryId: category?.id ?? "",
    offset: resolveOffsetForCategoryPage(resolvedSearchParams)
  });
  const listingsResult = category
    ? await fetchApi<ListingsPayload>(buildListingsPath(filters))
    : null;
  const suggestionsPath = buildSearchSuggestionsPath(filters.q);
  const suggestionsResult = suggestionsPath
    ? await fetchApi<SearchSuggestionsPayload>(suggestionsPath)
    : null;
  const listings = listingsResult?.ok ? listingsResult.data.listings : [];
  const searchSuggestions = suggestionsResult?.ok ? suggestionsResult.data.suggestions : [];
  const fallbackPagination: ListingsPagination = {
    limit: filters.limit,
    offset: filters.offset,
    total: listings.length,
    hasNextPage: false
  };
  const pagination = listingsResult?.ok
    ? listingsResult.data.pagination ?? fallbackPagination
    : fallbackPagination;
  const error = !categoriesResult.ok
    ? categoriesResult.error
    : listingsResult && !listingsResult.ok
      ? listingsResult.error
      : null;

  return (
    <SiteShell>
      <BrowsePageContent
        apiBaseUrl={getApiBaseUrl()}
        categories={categories}
        currentCategorySlug={category?.slug ?? null}
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

async function findCategoryBySlug(slug: string): Promise<Category | null> {
  const categoriesResult = await fetchApi<CategoriesPayload>("/api/v1/categories");

  if (!categoriesResult.ok) {
    return null;
  }

  return categoriesResult.data.categories.find((category) => category.slug === slug) ?? null;
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

function resolveOffsetForCategoryPage(searchParams: BrowseSearchParams): number {
  const rawOffset = readParam(searchParams?.offset);
  const parsedOffset = Number.parseInt(rawOffset, 10);

  if (!Number.isFinite(parsedOffset)) {
    return 0;
  }

  return Math.min(Math.max(parsedOffset, 0), 10000);
}

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
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

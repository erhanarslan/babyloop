import { SiteShell } from "../../components/ui";
import {
  buildListingsPath,
  resolveBrowseFilters,
  type BrowseSearchParams
} from "../../features/listings/browse-routing";
import { BrowsePageContent } from "../../features/listings/browse-page-content";
import {
  fetchApi,
  getApiBaseUrl,
  type CategoriesPayload,
  type ListingsPagination,
  type ListingsPayload,
  type SearchSuggestionsPayload
} from "../../lib/api";

export const dynamic = "force-dynamic";

type BrowsePageProps = {
  searchParams?: Promise<BrowseSearchParams>;
};

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = resolveBrowseFilters(resolvedSearchParams);
  const listingsPath = buildListingsPath(filters);
  const suggestionsPath = buildSearchSuggestionsPath(filters.q);
  const [categoriesResult, listingsResult, suggestionsResult] = await Promise.all([
    fetchApi<CategoriesPayload>("/api/v1/categories"),
    fetchApi<ListingsPayload>(listingsPath),
    suggestionsPath ? fetchApi<SearchSuggestionsPayload>(suggestionsPath) : Promise.resolve(null)
  ]);

  const categories = categoriesResult.ok ? categoriesResult.data.categories : [];
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
        currentCategorySlug={null}
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

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
  type ListingsPayload
} from "../../lib/api";

export const dynamic = "force-dynamic";

type BrowsePageProps = {
  searchParams?: Promise<BrowseSearchParams>;
};

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = resolveBrowseFilters(resolvedSearchParams);
  const listingsPath = buildListingsPath(filters);
  const [categoriesResult, listingsResult] = await Promise.all([
    fetchApi<CategoriesPayload>("/api/v1/categories"),
    fetchApi<ListingsPayload>(listingsPath)
  ]);

  const categories = categoriesResult.ok ? categoriesResult.data.categories : [];
  const listings = listingsResult.ok ? listingsResult.data.listings : [];
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
      />
    </SiteShell>
  );
}

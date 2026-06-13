import { SiteShell } from "../../components/ui";
import { BrowsePageContent } from "../../features/listings/browse-page-content";
import {
  fetchApi,
  getApiBaseUrl,
  type BrowseListingsFilters,
  type CategoriesPayload,
  type ListingsPagination,
  type ListingsPayload
} from "../../lib/api";

export const dynamic = "force-dynamic";

const DEFAULT_LISTINGS_LIMIT = 20;

type BrowsePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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
        error={error}
        filters={filters}
        listings={listings}
        pagination={pagination}
        searchQuery={filters.q}
      />
    </SiteShell>
  );
}

function resolveBrowseFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined
): BrowseListingsFilters {
  const offset = parsePositiveInteger(readParam(searchParams?.offset), 0);
  const limit = parsePositiveInteger(readParam(searchParams?.limit), DEFAULT_LISTINGS_LIMIT);

  return {
    q: readParam(searchParams?.q).trim(),
    categoryId: readParam(searchParams?.categoryId),
    condition: readParam(searchParams?.condition),
    listingType: readParam(searchParams?.listingType),
    sort: readParam(searchParams?.sort) || "newest",
    limit: Math.min(Math.max(limit, 1), 50),
    offset: Math.min(Math.max(offset, 0), 10000)
  };
}

function buildListingsPath(filters: BrowseListingsFilters): string {
  const params = new URLSearchParams();

  appendIfPresent(params, "q", filters.q);
  appendIfPresent(params, "categoryId", filters.categoryId);
  appendIfPresent(params, "condition", filters.condition);
  appendIfPresent(params, "listingType", filters.listingType);
  appendIfPresent(params, "sort", filters.sort);
  params.set("limit", String(filters.limit));
  params.set("offset", String(filters.offset));

  return `/api/v1/listings?${params.toString()}`;
}

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function appendIfPresent(params: URLSearchParams, key: string, value: string): void {
  if (value.trim().length > 0) {
    params.set(key, value.trim());
  }
}

import { SiteShell } from "../../components/ui";
import { BrowsePageContent } from "../../features/listings/browse-page-content";
import {
  fetchApi,
  getApiBaseUrl,
  type CategoriesPayload,
  type ListingsPayload
} from "../../lib/api";

export const dynamic = "force-dynamic";

type BrowsePageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams?.q?.trim() ?? "";
  const listingsPath = searchQuery.length >= 3
    ? `/api/v1/listings?q=${encodeURIComponent(searchQuery)}`
    : "/api/v1/listings";
  const [categoriesResult, listingsResult] = await Promise.all([
    fetchApi<CategoriesPayload>("/api/v1/categories"),
    fetchApi<ListingsPayload>(listingsPath)
  ]);

  const categories = categoriesResult.ok ? categoriesResult.data.categories : [];
  const listings = listingsResult.ok ? listingsResult.data.listings : [];
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
        listings={listings}
        searchQuery={searchQuery}
      />
    </SiteShell>
  );
}

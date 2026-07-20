import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { SiteShell } from "../../components/ui";
import { SellPageContent } from "../../features/listings/sell-page-content";
import { fetchApi, getApiBaseUrl, type CategoriesPayload } from "../../lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildNoIndexMetadata(
  "Create a BabyLoop listing",
  "Create a BabyLoop listing after signing in. This transactional page is not intended for search indexing."
);

export default async function SellPage() {
  const categoriesResult = await fetchApi<CategoriesPayload>("/api/v1/categories", { revalidate: 300 });
  const categories = categoriesResult.ok ? categoriesResult.data.categories : [];
  const error = categoriesResult.ok ? null : categoriesResult.error;

  return (
    <SiteShell>
      <SellPageContent
        apiBaseUrl={getApiBaseUrl()}
        categories={categories}
        error={error}
      />
    </SiteShell>
  );
}

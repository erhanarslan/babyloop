import { Alert, Card, PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { SellListingForm } from "../../features/listings/sell-listing-form";
import { fetchApi, getApiBaseUrl, type CategoriesPayload } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const categoriesResult = await fetchApi<CategoriesPayload>("/api/v1/categories");
  const categories = categoriesResult.ok ? categoriesResult.data.categories : [];
  const errorMessage = categoriesResult.ok ? null : categoriesResult.error.message;

  return (
    <SiteShell>
      <PageHeading
        eyebrow="Sell on BabyLoop"
        title="Create a manual listing"
        description="Add a local development listing with the read-only marketplace API now connected to a minimal create flow."
      />

      <PageContainer className="sell-layout" ariaLabel="Create listing form">
        {errorMessage ? (
          <Alert title="Marketplace API is not ready." message={errorMessage} />
        ) : null}

        <Card className="form-panel">
          <SellListingForm categories={categories} apiBaseUrl={getApiBaseUrl()} />
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

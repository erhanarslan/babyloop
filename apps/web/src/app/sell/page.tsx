import { SiteHeader } from "../../components/site-header";
import { SellListingForm } from "../../components/sell-listing-form";
import { fetchApi, getApiBaseUrl, type CategoriesPayload } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const categoriesResult = await fetchApi<CategoriesPayload>("/api/v1/categories");
  const categories = categoriesResult.ok ? categoriesResult.data.categories : [];
  const errorMessage = categoriesResult.ok ? null : categoriesResult.error.message;

  return (
    <main>
      <SiteHeader />

      <section className="section page-heading">
        <p className="eyebrow">Sell on BabyLoop</p>
        <h1>Create a manual listing</h1>
        <p>
          Add a local development listing with the read-only marketplace API now connected
          to a minimal create flow.
        </p>
      </section>

      <section className="section sell-layout" aria-label="Create listing form">
        {errorMessage ? (
          <div className="error-state" role="status">
            <h2>Marketplace API is not ready.</h2>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <div className="form-panel">
          <SellListingForm categories={categories} apiBaseUrl={getApiBaseUrl()} />
        </div>
      </section>
    </main>
  );
}

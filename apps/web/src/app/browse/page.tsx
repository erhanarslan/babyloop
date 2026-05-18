import Link from "next/link";
import {
  Alert,
  Card,
  EmptyState,
  PageContainer,
  PageHeading,
  SiteShell
} from "../../components/ui";
import {
  fetchApi,
  type CategoriesPayload,
  type ListingsPayload,
  type ListingSummary
} from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const [categoriesResult, listingsResult] = await Promise.all([
    fetchApi<CategoriesPayload>("/api/v1/categories"),
    fetchApi<ListingsPayload>("/api/v1/listings")
  ]);

  const categories = categoriesResult.ok ? categoriesResult.data.categories : [];
  const listings = listingsResult.ok ? listingsResult.data.listings : [];
  const errorMessage = !listingsResult.ok
    ? listingsResult.error.message
    : !categoriesResult.ok
      ? categoriesResult.error.message
      : null;

  return (
    <SiteShell>
      <PageHeading
        eyebrow="Browse marketplace"
        title="BabyLoop listings"
        description="Read-only marketplace data from the BabyLoop API. Search, favorites, and seller actions are intentionally not enabled yet."
      />

      <PageContainer className="browse-layout" ariaLabel="Browse listings">
        <Card as="aside" className="filter-panel" aria-label="Category filter placeholder">
          <h2>Categories</h2>
          {categories.length > 0 ? (
            <ul className="category-list">
              {categories.map((category) => (
                <li key={category.id}>
                  <span>{category.name}</span>
                  <small>{category.slug}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Categories will appear when the API is available.</p>
          )}
        </Card>

        <div className="listing-column">
          {errorMessage ? <ErrorNotice message={errorMessage} /> : null}

          {!errorMessage && listings.length === 0 ? (
            <EmptyState
              title="No active listings yet."
              message="Seed the local database to see sample marketplace listings."
            />
          ) : null}

          <div className="listing-grid">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </PageContainer>
    </SiteShell>
  );
}

function ListingCard({ listing }: { listing: ListingSummary }) {
  return (
    <article className="listing-card">
      <div className="listing-image" aria-label={`${listing.title} image preview`}>
        {listing.firstImage ? (
          <span>Image metadata</span>
        ) : (
          <span>No image</span>
        )}
      </div>
      <div className="listing-card-body">
        <div>
          <p className="listing-meta">{listing.category.name}</p>
          <h2>{listing.title}</h2>
        </div>
        <div className="listing-card-footer">
          <strong>{formatPrice(listing.price)}</strong>
          <Link href={`/listings/${listing.id}`}>View details</Link>
        </div>
      </div>
    </article>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <Alert title="Marketplace API is not ready." message={message} />;
}

function formatPrice(price: ListingSummary["price"]): string {
  if (!price) {
    return "Price on request";
  }

  return `${price.amount} ${price.currency}`;
}

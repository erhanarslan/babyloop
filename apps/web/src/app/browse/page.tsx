import Link from "next/link";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageContainer,
  PageHeading,
  SiteShell
} from "../../components/ui";
import { ListingImageFrame } from "../../features/listings/listing-image-frame";
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
          <p className="filter-note">Preview only. Real filtering will come later.</p>
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
      <ListingImageFrame
        alt={`${listing.title} product image`}
        className="listing-card-image"
        fallbackLabel="No product image"
        url={listing.firstImage?.url ?? null}
      />
      <div className="listing-card-body">
        <div>
          <div className="listing-card-badges">
            <Badge>{listing.category.name}</Badge>
            <Badge tone="success">{formatLabel(listing.listingType)}</Badge>
          </div>
          <h2>{listing.title}</h2>
          <p className="muted">Condition: {formatLabel(listing.condition)}</p>
        </div>
        <div className="listing-card-footer">
          <strong>{formatPrice(listing.price)}</strong>
          <Link href={`/listings/${listing.id}`}>View details</Link>
        </div>
      </div>
    </article>
  );
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
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

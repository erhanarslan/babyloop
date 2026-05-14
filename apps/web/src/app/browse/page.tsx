import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
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
    <main>
      <SiteHeader />

      <section className="section page-heading">
        <p className="eyebrow">Browse marketplace</p>
        <h1>BabyLoop listings</h1>
        <p>
          Read-only marketplace data from the BabyLoop API. Search, favorites,
          and seller actions are intentionally not enabled yet.
        </p>
      </section>

      <section className="section browse-layout" aria-label="Browse listings">
        <aside className="filter-panel" aria-label="Category filter placeholder">
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
        </aside>

        <div className="listing-column">
          {errorMessage ? <ErrorNotice message={errorMessage} /> : null}

          {!errorMessage && listings.length === 0 ? (
            <div className="empty-state">
              <h2>No active listings yet.</h2>
              <p>Seed the local database to see sample marketplace listings.</p>
            </div>
          ) : null}

          <div className="listing-grid">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </section>
    </main>
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
  return (
    <div className="error-state" role="status">
      <h2>Marketplace API is not ready.</h2>
      <p>{message}</p>
    </div>
  );
}

function formatPrice(price: ListingSummary["price"]): string {
  if (!price) {
    return "Price on request";
  }

  return `${price.amount} ${price.currency}`;
}

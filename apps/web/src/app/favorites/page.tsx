import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import {
  fetchApi,
  LOCAL_DEV_PROFILE_ID,
  type FavoriteListing,
  type FavoritesPayload
} from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const result = await fetchApi<FavoritesPayload>(
    `/api/v1/profiles/${LOCAL_DEV_PROFILE_ID}/favorites`
  );

  return (
    <main>
      <SiteHeader />

      <section className="section page-heading">
        <p className="eyebrow">Local dev profile</p>
        <h1>Saved listings</h1>
        <p>
          Favorites are connected to the temporary local profile until authentication is added.
        </p>
      </section>

      <section className="section listing-column" aria-label="Favorite listings">
        {!result.ok ? (
          <div className="error-state">
            <h2>Favorites unavailable</h2>
            <p>{result.error.message}</p>
          </div>
        ) : result.data.favorites.length === 0 ? (
          <div className="empty-state">
            <h2>No saved listings yet.</h2>
            <p>Open a listing detail page and save it for this local development profile.</p>
            <Link className="primary-link" href="/browse">
              Browse listings
            </Link>
          </div>
        ) : (
          <div className="listing-grid">
            {result.data.favorites.map((favorite) => (
              <FavoriteCard favorite={favorite} key={favorite.id} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function FavoriteCard({ favorite }: { favorite: FavoriteListing }) {
  return (
    <article className="listing-card">
      <div className="listing-card-body">
        <div>
          <p className="listing-meta">{favorite.category.name}</p>
          <h2>{favorite.title}</h2>
        </div>
        <p className="muted">Saved {new Date(favorite.favoritedAt).toLocaleDateString("en-US")}</p>
        <div className="listing-card-footer">
          <strong>{formatPrice(favorite.price)}</strong>
          <Link href={`/listings/${favorite.id}`}>View details</Link>
        </div>
      </div>
    </article>
  );
}

function formatPrice(price: FavoriteListing["price"]): string {
  if (!price) {
    return "Price on request";
  }

  return `${price.amount} ${price.currency}`;
}

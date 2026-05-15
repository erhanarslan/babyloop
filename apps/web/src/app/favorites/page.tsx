import { FavoritesList } from "../../components/favorites-list";
import { SiteHeader } from "../../components/site-header";
import { getApiBaseUrl } from "../../lib/api";

export default function FavoritesPage() {
  return (
    <main>
      <SiteHeader />

      <section className="section page-heading">
        <p className="eyebrow">Your profile</p>
        <h1>Saved listings</h1>
        <p>Favorites are connected to your logged-in BabyLoop profile.</p>
      </section>

      <section className="section listing-column" aria-label="Favorite listings">
        <FavoritesList apiBaseUrl={getApiBaseUrl()} />
      </section>
    </main>
  );
}

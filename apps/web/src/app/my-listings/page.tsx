import { SiteHeader } from "../../components/site-header";
import { MyListingsList } from "../../features/listings/my-listings-list";
import { getApiBaseUrl } from "../../lib/api";

export default function MyListingsPage() {
  return (
    <main>
      <SiteHeader />

      <section className="section page-heading">
        <p className="eyebrow">Seller workspace</p>
        <h1>My listings</h1>
        <p>View listings owned by your logged-in BabyLoop profile.</p>
      </section>

      <section className="section listing-column" aria-label="My listings">
        <MyListingsList apiBaseUrl={getApiBaseUrl()} />
      </section>
    </main>
  );
}

import Link from "next/link";
import { SiteHeader } from "../../../components/site-header";

export default function ListingNotFound() {
  return (
    <main>
      <SiteHeader />
      <section className="section page-heading">
        <p className="eyebrow">Listing detail</p>
        <h1>Listing not found</h1>
        <p>The listing may be inactive, removed, or not available in the current seed data.</p>
        <Link className="primary-link" href="/browse">
          Back to browse
        </Link>
      </section>
    </main>
  );
}

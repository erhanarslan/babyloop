import { SiteHeader } from "../../../components/site-header";

export default function ListingDetailLoading() {
  return (
    <main>
      <SiteHeader />
      <section className="section page-heading">
        <p className="eyebrow">Listing detail</p>
        <h1>Loading listing</h1>
        <p>Fetching listing detail from the BabyLoop API.</p>
      </section>
    </main>
  );
}

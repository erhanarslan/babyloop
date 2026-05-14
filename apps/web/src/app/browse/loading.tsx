import { SiteHeader } from "../../components/site-header";

export default function BrowseLoading() {
  return (
    <main>
      <SiteHeader />
      <section className="section page-heading">
        <p className="eyebrow">Browse marketplace</p>
        <h1>Loading listings</h1>
        <p>Fetching read-only marketplace data from the BabyLoop API.</p>
      </section>
    </main>
  );
}

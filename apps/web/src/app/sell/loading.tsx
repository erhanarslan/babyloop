import { SiteHeader } from "../../components/site-header";

export default function SellLoading() {
  return (
    <main>
      <SiteHeader />
      <section className="section page-heading">
        <p className="eyebrow">Sell on BabyLoop</p>
        <h1>Loading listing form...</h1>
      </section>
    </main>
  );
}

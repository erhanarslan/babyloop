export default function HomePage() {
  const navItems = ["Home", "Browse", "Sell", "AI Valuation", "Login"];
  const aiFeatures = [
    "Price guidance",
    "Listing suggestions",
    "Parent assistant"
  ];

  return (
    <main>
      <header className="site-header" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="BabyLoop home">
          BabyLoop
        </a>
        <nav className="nav-links">
          {navItems.map((item) => (
            <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`}>
              {item}
            </a>
          ))}
        </nav>
      </header>

      <section className="hero section" id="home" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">Baby and family marketplace</p>
          <h1 id="page-title">BabyLoop</h1>
          <p className="hero-text">
            A focused marketplace shell for buying, selling, swapping,
            donating, renting, and evaluating baby-related products.
          </p>
        </div>
        <div className="hero-panel" aria-label="Marketplace preview">
          <div className="panel-row strong">
            <span>Stroller set</span>
            <strong>AI price range</strong>
          </div>
          <div className="panel-row">
            <span>Car seat checklist</span>
            <strong>Safety review</strong>
          </div>
          <div className="panel-row">
            <span>6-9 month stage</span>
            <strong>Next picks</strong>
          </div>
        </div>
      </section>

      <section className="section split" id="browse" aria-labelledby="concept-title">
        <div>
          <p className="eyebrow">Marketplace concept</p>
          <h2 id="concept-title">One place for short-lived family essentials.</h2>
        </div>
        <p>
          BabyLoop is designed around parent workflows: discover age-relevant
          products, create trustworthy listings, compare fair prices, and keep
          safety-sensitive categories visible for review.
        </p>
      </section>

      <section className="section" id="ai-valuation" aria-labelledby="ai-title">
        <p className="eyebrow">AI-powered preview</p>
        <h2 id="ai-title">AI support without autonomous decisions.</h2>
        <div className="feature-grid">
          {aiFeatures.map((feature) => (
            <article className="feature-card" key={feature}>
              <h3>{feature}</h3>
              <p>Planned as an auditable helper, not a replacement for user judgment.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section trust" id="sell" aria-labelledby="trust-title">
        <div>
          <p className="eyebrow">Safety and trust</p>
          <h2 id="trust-title">Built for careful baby product decisions.</h2>
        </div>
        <ul className="trust-list">
          <li>Behavior-based moderation signals</li>
          <li>Human review for high-impact actions</li>
          <li>Warnings instead of safety guarantees</li>
        </ul>
      </section>
    </main>
  );
}

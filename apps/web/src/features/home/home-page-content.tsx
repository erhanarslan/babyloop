"use client";

import { useI18n } from "../../lib/i18n/i18n-provider";
import { HomeAuthActions } from "./home-auth-actions";
import { HomePersonalizationFeed } from "./home-personalization-feed";
import { ParentGuidePreviewSection } from "../parent-guides/parent-guide-preview-section";

type HomePageContentProps = {
  apiBaseUrl: string;
};

export function HomePageContent({ apiBaseUrl }: HomePageContentProps) {
  const { dictionary } = useI18n();

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">{dictionary.home.eyebrow}</p>
          <h1>{dictionary.home.title}</h1>
          <p>{dictionary.home.subtitle}</p>
          <HomeAuthActions apiBaseUrl={apiBaseUrl} />
        </div>

        <HeroPreviewCard />
      </section>

      <HomePersonalizationFeed apiBaseUrl={apiBaseUrl} />

      <ParentGuidePreviewSection />

      <section className="home-section">
        <div className="home-section-heading">
          <p className="eyebrow">{dictionary.home.howEyebrow}</p>
          <h2>{dictionary.home.howTitle}</h2>
          <p>{dictionary.home.howDescription}</p>
        </div>

        <div className="home-card-grid">
          {dictionary.home.steps.map((item) => (
            <FeatureCard key={item.title} body={item.body} title={item.title} />
          ))}
        </div>
      </section>

      <section className="home-section home-section-tint">
        <div className="home-section-heading">
          <p className="eyebrow">{dictionary.home.categoriesEyebrow}</p>
          <h2>{dictionary.home.categoriesTitle}</h2>
          <p>{dictionary.home.categoriesDescription}</p>
        </div>

        <div className="home-card-grid">
          {dictionary.home.categoryCards.map((item) => (
            <FeatureCard key={item.title} body={item.body} title={item.title} />
          ))}
        </div>
      </section>

      <section className="home-section safety-section" id="safety">
        <div className="home-section-heading">
          <p className="eyebrow">{dictionary.home.safetyEyebrow}</p>
          <h2>{dictionary.home.safetyTitle}</h2>
          <p>{dictionary.home.safetyDescription}</p>
        </div>

        <div className="safety-card-list">
          {dictionary.home.safetyItems.map((item, index) => (
            <article key={item} className="safety-card">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-final-cta">
        <div>
          <p className="eyebrow">{dictionary.home.eyebrow}</p>
          <h2>{dictionary.home.finalTitle}</h2>
          <p>{dictionary.home.finalDescription}</p>
        </div>
        <HomeAuthActions apiBaseUrl={apiBaseUrl} compact />
      </section>
    </>
  );
}

function HeroPreviewCard() {
  const { dictionary } = useI18n();

  return (
    <aside className="hero-preview-card" aria-label="BabyLoop marketplace preview">
      <div className="preview-card-header">
        <span>{dictionary.home.previewStatus}</span>
        <strong>{dictionary.home.previewCategory}</strong>
      </div>
      <div className="preview-listing">
        <div className="preview-image" aria-hidden="true" />
        <div>
          <h2>{dictionary.home.previewTitle}</h2>
          <p>{dictionary.home.previewDescription}</p>
          <strong>{dictionary.home.previewPrice}</strong>
        </div>
      </div>
      <div className="preview-metrics">
        <div>
          <span>{dictionary.nav.account}</span>
          <strong>{dictionary.home.previewTrust}</strong>
        </div>
        <div>
          <span>{dictionary.nav.messages}</span>
          <strong>{dictionary.home.steps[2]?.title}</strong>
        </div>
        <div>
          <span>{dictionary.nav.favorites}</span>
          <strong>{dictionary.common.browseMarketplace}</strong>
        </div>
      </div>
    </aside>
  );
}

function FeatureCard({ body, title }: { body: string; title: string }) {
  return (
    <article className="home-feature-card">
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

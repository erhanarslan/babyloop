"use client";

import Link from "next/link";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { HomeAuthActions } from "./home-auth-actions";
import { HomePersonalizationFeed } from "./home-personalization-feed";
import { ParentGuidePreviewSection } from "../parent-guides/parent-guide-preview-section";

type HomePageContentProps = {
  apiBaseUrl: string;
};

const productPillars = [
  {
    eyebrow: "Marketplace",
    title: "Find parent-owned essentials without noisy feeds",
    body: "Browse listings by category, condition, photos, price, and status so everyday baby purchases stay practical.",
    href: "/browse",
    label: "Browse listings"
  },
  {
    eyebrow: "Seller tools",
    title: "Create clearer listings with guided preparation",
    body: "AI-assisted drafts, price suggestions, image checks, and seller insights help families pass items along with less friction.",
    href: "/sell",
    label: "Create listing"
  },
  {
    eyebrow: "Lifecycle planning",
    title: "Plan around age bands instead of guesswork",
    body: "Child profiles use privacy-light age bands to connect upcoming needs with guides, saved searches, and relevant categories.",
    href: "/account/children",
    label: "Add child profile"
  },
  {
    eyebrow: "Assistant",
    title: "Ask for safer buying checks and next-step guidance",
    body: "BabyLoop Assistant connects product discovery, selling help, parent guides, and safer second-hand questions in one flow.",
    href: "/assistant",
    label: "Open Assistant"
  }
];

const marketplaceLoop = [
  {
    title: "Discover",
    body: "Search categories, active listings, guides, and saved searches from one SEO-friendly public surface."
  },
  {
    title: "Evaluate",
    body: "Review condition, photos, seller-safe context, buyer checklists, related guides, and contextual assistant prompts."
  },
  {
    title: "Connect",
    body: "Message before meeting, keep contact details private, report unsafe behavior, and preserve trust signals."
  },
  {
    title: "Reuse",
    body: "Archive, restore, mark sold, save useful searches, and keep family essentials moving through the loop."
  }
];

const trustSignals = [
  "Public listings stay privacy-safe",
  "Private account areas are noindex",
  "Messaging is participant-only",
  "Reports, blocks, moderation, and audit trails are built in"
];

export function HomePageContent({ apiBaseUrl }: HomePageContentProps) {
  const { dictionary } = useI18n();

  return (
    <>
      <section className="home-hero home-hero-product">
        <div className="home-hero-copy">
          <p className="eyebrow">{dictionary.home.eyebrow}</p>
          <h1>{dictionary.home.title}</h1>
          <p>{dictionary.home.subtitle}</p>

          <HomeAuthActions apiBaseUrl={apiBaseUrl} />

          <div className="home-proof-row" aria-label="BabyLoop product strengths">
            <span>SEO-ready marketplace pages</span>
            <span>Trust & Safety foundation</span>
            <span>AI-guided discovery</span>
          </div>
        </div>

        <HeroPreviewCard />
      </section>

      <section className="home-section home-product-system">
        <div className="home-section-heading">
          <p className="eyebrow">Product ecosystem</p>
          <h2>One loop for buying, selling, planning, and asking smarter questions.</h2>
          <p>
            BabyLoop connects marketplace discovery with parent education, age-band needs, safer messaging,
            seller tooling, and an assistant layer that can grow into grounded AI workflows.
          </p>
        </div>

        <div className="product-system-grid">
          {productPillars.map((pillar) => (
            <ProductPillarCard key={pillar.title} {...pillar} />
          ))}
        </div>
      </section>

      <HomePersonalizationFeed apiBaseUrl={apiBaseUrl} />

      <section className="home-section home-loop-section">
        <div className="home-section-heading">
          <p className="eyebrow">Marketplace loop</p>
          <h2>A complete parent journey, not a single listing page.</h2>
          <p>
            The web experience is designed as a conversion path: discovery, evaluation, messaging,
            reuse, and continued planning across saved searches and child profiles.
          </p>
        </div>

        <div className="home-loop-grid">
          {marketplaceLoop.map((step, index) => (
            <article key={step.title} className="home-loop-card">
              <span className="home-loop-index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <ParentGuidePreviewSection />

      <section className="home-section assistant-home-cta">
        <div className="home-section-heading">
          <p className="eyebrow">BabyLoop Assistant</p>
          <h2>Turn product questions into safer buying and selling decisions.</h2>
          <p>
            Ask for age-band needs, seller listing tips, second-hand buying checks, category guidance,
            and next-step marketplace actions without leaving the discovery flow.
          </p>
        </div>
        <div className="home-personalization-actions parent-guide-preview-actions">
          <Link href="/assistant">Open Assistant</Link>
          <Link href="/guides">Read guides</Link>
          <Link href="/account/children">Add child profile</Link>
        </div>
      </section>

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

        <div className="home-trust-stack">
          <div className="safety-card-list">
            {dictionary.home.safetyItems.map((item, index) => (
              <article key={item} className="safety-card">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </article>
            ))}
          </div>

          <aside className="home-trust-card" aria-label="BabyLoop trust architecture">
            <p className="eyebrow">Trust architecture</p>
            <h3>Built for public discovery and private account safety.</h3>
            <ul>
              {trustSignals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          </aside>
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

function ProductPillarCard({
  body,
  eyebrow,
  href,
  label,
  title
}: {
  body: string;
  eyebrow: string;
  href: string;
  label: string;
  title: string;
}) {
  return (
    <article className="product-system-card">
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{body}</p>
      <Link href={href}>{label}</Link>
    </article>
  );
}

function HeroPreviewCard() {
  const { dictionary } = useI18n();

  return (
    <aside className="hero-preview-card hero-preview-card-product" aria-label="BabyLoop marketplace preview">
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

      <div className="hero-preview-assistant">
        <p className="eyebrow">Assistant prompt</p>
        <p>“What should I check before buying this second-hand stroller?”</p>
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

      <div className="preview-route-row">
        <Link href="/browse">Browse</Link>
        <Link href="/assistant">Ask Assistant</Link>
        <Link href="/sell">Sell</Link>
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

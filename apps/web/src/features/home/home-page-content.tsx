"use client";

import Link from "next/link";
import {
  babyCategoryGroups,
  popularSearches,
  quickCategoryLinks
} from "../../components/navigation/public-navigation-model";
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
      <section className="home-hero home-marketplace-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">{dictionary.publicPages.home.heroEyebrow}</p>
          <h1>{dictionary.publicPages.home.heroTitle}</h1>
          <p>{dictionary.publicPages.home.heroBody}</p>

          <div className="home-marketplace-actions">
            <Link href="/browse">{dictionary.publicPages.home.browseCta}</Link>
            <Link href="/sell">{dictionary.publicPages.home.sellCta}</Link>
          </div>

          <div className="home-popular-searches" aria-label={dictionary.publicPages.home.popularTitle}>
            {popularSearches.map((term) => (
              <Link href={`/browse?q=${encodeURIComponent(term)}`} key={term}>
                {term}
              </Link>
            ))}
          </div>
        </div>

        <aside className="home-marketplace-preview" aria-label={dictionary.publicPages.home.categoriesTitle}>
          <strong>{dictionary.publicPages.home.categoriesTitle}</strong>
          <div>
            {quickCategoryLinks.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="home-section home-category-strip">
        <div className="home-section-heading">
          <p className="eyebrow">{dictionary.publicPages.home.categoriesTitle}</p>
          <h2>{dictionary.publicPages.home.trustTitle}</h2>
          <p>{dictionary.publicPages.home.trustBody}</p>
        </div>

        <div className="home-category-grid">
          {babyCategoryGroups.map((group) => (
            <article className="home-category-card" key={group.id}>
              <span aria-hidden="true">{group.icon}</span>
              <h3>{dictionary.publicShell.categoryGroups[group.id]}</h3>
              <div>
                {group.links.slice(0, 3).map((item) => (
                  <Link href={item.href} key={item.href}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <HomePersonalizationFeed apiBaseUrl={apiBaseUrl} />

      <section className="home-section home-helper-section">
        <div className="home-section-heading">
          <p className="eyebrow">{dictionary.publicPages.support.guidesTitle}</p>
          <h2>{dictionary.publicPages.support.assistantTitle}</h2>
          <p>{dictionary.publicPages.support.compactBoundary}</p>
        </div>
        <div className="home-marketplace-actions secondary">
          <Link href="/guides">{dictionary.publicPages.support.guidesTitle}</Link>
          <Link href="/assistant">{dictionary.publicShell.header.assistant}</Link>
          <Link href="/account/children">{dictionary.publicShell.accountMenu.childProfiles}</Link>
        </div>
      </section>

      <ParentGuidePreviewSection />

      <section className="home-final-cta">
        <div>
          <p className="eyebrow">{dictionary.publicPages.home.heroEyebrow}</p>
          <h2>{dictionary.home.finalTitle}</h2>
          <p>{dictionary.home.finalDescription}</p>
        </div>
        <HomeAuthActions apiBaseUrl={apiBaseUrl} compact />
      </section>
    </>
  );
}

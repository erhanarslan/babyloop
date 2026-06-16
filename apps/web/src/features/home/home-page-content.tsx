"use client";

import Link from "next/link";
import {
  babyCategoryGroups
} from "../../components/navigation/public-navigation-model";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { HomeAuthActions } from "./home-auth-actions";
import { HomePersonalizationFeed } from "./home-personalization-feed";
import { LatestListingRotator } from "./latest-listing-rotator";
import { ParentGuidePreviewSection } from "../parent-guides/parent-guide-preview-section";
import { HomeFeaturedShowcase } from "./home-featured-showcase";

type HomePageContentProps = {
  apiBaseUrl: string;
};

export function HomePageContent({ apiBaseUrl }: HomePageContentProps) {
  const { dictionary } = useI18n();

  return (
    <>
      <HomeFeaturedShowcase />

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

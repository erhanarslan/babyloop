"use client";

import Link from "next/link";

import { Card, PageContainer, PageHeading } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { FavoritesList } from "./favorites-list";

type FavoritesPageContentProps = {
  apiBaseUrl: string;
};

const favoriteDecisionSteps = [
  {
    title: "Shortlist",
    body: "Use favorites to keep promising listings visible while comparing price, category, type, and condition."
  },
  {
    title: "Validate",
    body: "Open details, review photos, ask safer buyer questions, and use parent guides before messaging."
  },
  {
    title: "Refresh",
    body: "Remove irrelevant, sold, archived, or outdated items so your saved list stays actionable."
  }
];

export function FavoritesPageContent({ apiBaseUrl }: FavoritesPageContentProps) {
  const { dictionary } = useI18n();

  return (
    <>
      <PageHeading
        eyebrow={dictionary.marketplace.favoritesEyebrow}
        title={dictionary.marketplace.favoritesTitle}
        description={dictionary.marketplace.favoritesDescription}
      />

      <PageContainer className="favorites-discovery-layout listing-column" ariaLabel={dictionary.marketplace.favoritesAriaLabel}>
        <Card as="section" className="favorites-hero" aria-label="Favorites buyer workspace overview">
          <div>
            <p className="eyebrow">Buyer shortlist</p>
            <h2>Turn saved listings into clearer buying decisions.</h2>
            <p>
              Favorites help you compare condition, price, category fit, and seller-safe questions
              before starting a conversation. Keep this list focused on items you can actually act on.
            </p>
            <div className="favorites-hero-actions">
              <Link href="/browse">Browse marketplace</Link>
              <Link href="/account/saved-searches">Saved searches</Link>
              <Link href="/assistant?mode=safe_buying&prompt=Help%20me%20compare%20my%20saved%20BabyLoop%20favorites.">
                Ask shortlist assistant
              </Link>
            </div>
          </div>

          <aside className="favorites-hero-principles" aria-label="Favorites principles">
            <div>
              <span>Compare</span>
              <strong>Condition, price, photos, category</strong>
            </div>
            <div>
              <span>Decide</span>
              <strong>Open detail before messaging</strong>
            </div>
            <div>
              <span>Clean up</span>
              <strong>Remove stale saved items</strong>
            </div>
          </aside>
        </Card>

        <section className="favorite-decision-grid" aria-label="Favorites decision workflow">
          {favoriteDecisionSteps.map((step, index) => (
            <Card as="article" className="favorite-decision-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </Card>
          ))}
        </section>

        <FavoritesList apiBaseUrl={apiBaseUrl} />
      </PageContainer>
    </>
  );
}

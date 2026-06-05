"use client";

import { PageContainer, PageHeading } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { FavoritesList } from "./favorites-list";

type FavoritesPageContentProps = {
  apiBaseUrl: string;
};

export function FavoritesPageContent({ apiBaseUrl }: FavoritesPageContentProps) {
  const { dictionary } = useI18n();

  return (
    <>
      <PageHeading
        eyebrow={dictionary.marketplace.favoritesEyebrow}
        title={dictionary.marketplace.favoritesTitle}
        description={dictionary.marketplace.favoritesDescription}
      />

      <PageContainer className="listing-column" ariaLabel={dictionary.marketplace.favoritesAriaLabel}>
        <FavoritesList apiBaseUrl={apiBaseUrl} />
      </PageContainer>
    </>
  );
}

"use client";

import { PageContainer } from "../../components/ui";
import { FavoritesList } from "./favorites-list";

type FavoritesPageContentProps = {
  apiBaseUrl: string;
};

export function FavoritesPageContent({ apiBaseUrl }: FavoritesPageContentProps) {
  return (
    <PageContainer className="pb-12 pt-5" ariaLabel="Favoriler">
      <FavoritesList apiBaseUrl={apiBaseUrl} />
    </PageContainer>
  );
}

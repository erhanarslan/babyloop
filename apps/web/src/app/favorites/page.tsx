import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { SiteShell } from "../../components/ui";
import { FavoritesPageContent } from "../../features/favorites/favorites-page-content";
import { getApiBaseUrl } from "../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Favoriler",
  "BabyLoop favori sayfaları özel alandır ve indekslenmez."
);

export default function FavoritesPage() {
  return (
    <SiteShell>
      <FavoritesPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

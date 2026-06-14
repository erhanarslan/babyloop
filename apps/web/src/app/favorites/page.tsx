import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { SiteShell } from "../../components/ui";
import { FavoritesPageContent } from "../../features/favorites/favorites-page-content";
import { getApiBaseUrl } from "../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Saved listings",
  "BabyLoop favorites pages are private and not indexed."
);

export default function FavoritesPage() {
  return (
    <SiteShell>
      <FavoritesPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

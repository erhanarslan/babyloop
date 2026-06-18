import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { SiteShell } from "../../components/ui";
import { MyListingsPageContent } from "../../features/listings/my-listings-page-content";
import { getApiBaseUrl } from "../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "İlanlarım",
  "BabyLoop ilan yönetimi sayfaları özel alandır ve indekslenmez."
);

export default function MyListingsPage() {
  return (
    <SiteShell>
      <MyListingsPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

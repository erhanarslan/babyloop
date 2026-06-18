import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { SiteShell } from "../../../components/ui";
import { SellerDashboardPageContent } from "../../../features/seller-dashboard/seller-dashboard-page-content";
import { getApiBaseUrl } from "../../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Satıcı paneli",
  "BabyLoop satıcı paneli sayfaları özel alandır ve indekslenmez."
);

export default function AccountSellerPage() {
  return (
    <SiteShell>
      <SellerDashboardPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { SiteShell } from "../../../components/ui";
import { SellerDashboardPageContent } from "../../../features/seller-dashboard/seller-dashboard-page-content";
import { getApiBaseUrl } from "../../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Seller dashboard",
  "BabyLoop seller dashboard pages are private and not indexed."
);

export default function AccountSellerPage() {
  return (
    <SiteShell>
      <SellerDashboardPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

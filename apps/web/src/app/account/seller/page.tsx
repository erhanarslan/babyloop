import { SiteShell } from "../../../components/ui";
import { SellerDashboardPageContent } from "../../../features/seller-dashboard/seller-dashboard-page-content";
import { getApiBaseUrl } from "../../../lib/api";

export default function AccountSellerPage() {
  return (
    <SiteShell>
      <SellerDashboardPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

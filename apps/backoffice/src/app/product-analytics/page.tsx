import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";
import { ProductAnalyticsDashboard } from "../../features/product-analytics/product-analytics-dashboard";

export default function BackofficeProductAnalyticsPage() {
  return (
    <BackofficeAuthShell>
      <ProductAnalyticsDashboard />
    </BackofficeAuthShell>
  );
}

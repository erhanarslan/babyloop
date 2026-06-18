import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { SiteShell } from "../../components/ui";
import { NotificationsPageContent } from "../../features/notifications/notifications-page-content";
import { getApiBaseUrl } from "../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Bildirimler",
  "BabyLoop bildirim sayfaları özel alandır ve indekslenmez."
);

export default function NotificationsPage() {
  return (
    <SiteShell>
      <NotificationsPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { SiteShell } from "../../components/ui";
import { NotificationsPageContent } from "../../features/notifications/notifications-page-content";
import { getApiBaseUrl } from "../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Notifications",
  "BabyLoop notification pages are private and not indexed."
);

export default function NotificationsPage() {
  return (
    <SiteShell>
      <NotificationsPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

import type { Metadata } from "next";
import { SiteShell } from "../../../components/ui";
import { getApiBaseUrl } from "../../../lib/api";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { NotificationPreferencesPageContent } from "../../../features/notification-preferences/notification-preferences-page-content";

export const metadata: Metadata = buildNoIndexMetadata(
  "Bildirim tercihleri",
  "BabyLoop bildirim tercihleri sayfası özel alandır ve indekslenmez."
);

export default function AccountNotificationPreferencesPage() {
  return (
    <SiteShell>
      <NotificationPreferencesPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

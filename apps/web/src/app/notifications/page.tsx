import { SiteShell } from "../../components/ui";
import { NotificationsPageContent } from "../../features/notifications/notifications-page-content";
import { getApiBaseUrl } from "../../lib/api";

export default function NotificationsPage() {
  return (
    <SiteShell>
      <NotificationsPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

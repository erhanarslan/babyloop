import { SiteShell } from "../../components/ui";
import { ConversationsPageContent } from "../../features/messaging/conversations-page-content";
import { getApiBaseUrl } from "../../lib/api";

export default function ConversationsPage() {
  return (
    <SiteShell>
      <ConversationsPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

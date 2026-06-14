import { SiteShell } from "../../components/ui";
import { AssistantPageContent } from "../../features/assistant/assistant-page-content";
import { getApiBaseUrl } from "../../lib/api";

export default function AssistantPage() {
  return (
    <SiteShell>
      <AssistantPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

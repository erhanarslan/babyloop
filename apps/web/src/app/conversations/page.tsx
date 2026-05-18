import { PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { ConversationList } from "../../features/messaging/conversation-list";
import { getApiBaseUrl } from "../../lib/api";

export default function ConversationsPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Messages"
        title="Conversations"
        description="Keep buyer and seller messages in one conversation per profile pair."
      />
      <PageContainer className="conversations-layout">
        <ConversationList apiBaseUrl={getApiBaseUrl()} />
      </PageContainer>
    </SiteShell>
  );
}

import { PageContainer, PageHeading, SiteShell } from "../../../components/ui";
import { MessageThread } from "../../../features/messaging/message-thread";
import { getApiBaseUrl } from "../../../lib/api";

type ConversationPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { id } = await params;

  return (
    <SiteShell>
      <PageHeading eyebrow="Messages" title="Conversation" />
      <PageContainer className="conversations-layout">
        <MessageThread apiBaseUrl={getApiBaseUrl()} conversationId={id} />
      </PageContainer>
    </SiteShell>
  );
}

import { SiteShell } from "../../../components/ui";
import { ConversationPageContent } from "../../../features/messaging/conversation-page-content";
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
      <ConversationPageContent apiBaseUrl={getApiBaseUrl()} conversationId={id} />
    </SiteShell>
  );
}

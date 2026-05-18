import { SiteHeader } from "../../../components/site-header";
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
    <main>
      <SiteHeader />
      <section className="section page-heading">
        <p className="eyebrow">Messages</p>
        <h1>Conversation</h1>
      </section>
      <section className="section conversations-layout">
        <MessageThread apiBaseUrl={getApiBaseUrl()} conversationId={id} />
      </section>
    </main>
  );
}

import { SiteHeader } from "../../components/site-header";
import { ConversationList } from "../../features/messaging/conversation-list";
import { getApiBaseUrl } from "../../lib/api";

export default function ConversationsPage() {
  return (
    <main>
      <SiteHeader />
      <section className="section page-heading">
        <p className="eyebrow">Messages</p>
        <h1>Conversations</h1>
        <p>Keep buyer and seller messages in one conversation per profile pair.</p>
      </section>
      <section className="section conversations-layout">
        <ConversationList apiBaseUrl={getApiBaseUrl()} />
      </section>
    </main>
  );
}

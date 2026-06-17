import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { SiteShell } from "../../components/ui";
import { ConversationsPageContent } from "../../features/messaging/conversations-page-content";
import { getApiBaseUrl } from "../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Mesajlar",
  "BabyLoop mesaj sayfaları özeldir ve indekslenmez."
);

type ConversationsPageProps = {
  searchParams: Promise<{
    conversationId?: string | string[];
  }>;
};

export default async function ConversationsPage({ searchParams }: ConversationsPageProps) {
  const resolvedSearchParams = await searchParams;
  const selectedConversationId = Array.isArray(resolvedSearchParams.conversationId)
    ? resolvedSearchParams.conversationId[0]
    : resolvedSearchParams.conversationId;

  return (
    <SiteShell>
      <ConversationsPageContent
        apiBaseUrl={getApiBaseUrl()}
        selectedConversationId={selectedConversationId}
      />
    </SiteShell>
  );
}

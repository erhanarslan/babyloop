"use client";

import { PageContainer } from "../../components/ui";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";

type ConversationPageContentProps = {
  apiBaseUrl: string;
  conversationId: string;
};

export function ConversationPageContent({
  apiBaseUrl,
  conversationId
}: ConversationPageContentProps) {
  return (
    <PageContainer className="max-w-7xl py-4 sm:py-6" ariaLabel="Konuşma">
      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="hidden rounded-[1.75rem] border border-border bg-background/88 p-4 shadow-sm backdrop-blur lg:block lg:h-[calc(100dvh-190px)] lg:min-h-[620px]">
          <ConversationList
            apiBaseUrl={apiBaseUrl}
            getConversationHref={(nextConversationId) => `/conversations?conversationId=${encodeURIComponent(nextConversationId)}`}
            selectedConversationId={conversationId}
          />
        </section>
        <MessageThread apiBaseUrl={apiBaseUrl} conversationId={conversationId} />
      </div>
    </PageContainer>
  );
}

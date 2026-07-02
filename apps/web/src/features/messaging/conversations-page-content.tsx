"use client";

import { PageContainer } from "../../components/ui";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";

type ConversationsPageContentProps = {
  apiBaseUrl: string;
  selectedConversationId?: string | undefined;
};

export function ConversationsPageContent({
  apiBaseUrl,
  selectedConversationId
}: ConversationsPageContentProps) {
  const hasSelectedConversation = Boolean(selectedConversationId);

  return (
    <PageContainer className="messages-p0-page max-w-7xl py-4 sm:py-6" ariaLabel="Mesajlar">
      <div className="messages-p0-layout grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section
          className={[
            "messages-p0-list-panel rounded-[1.5rem] border border-border bg-background/88 p-3 shadow-sm backdrop-blur sm:p-4 lg:h-[calc(100dvh-190px)] lg:min-h-[620px]",
            hasSelectedConversation ? "hidden lg:block" : ""
          ].join(" ")}
        >
          <ConversationList
            apiBaseUrl={apiBaseUrl}
            getConversationHref={(conversationId) => `/conversations?conversationId=${encodeURIComponent(conversationId)}`}
            selectedConversationId={selectedConversationId}
          />
        </section>
        {selectedConversationId ? (
          <MessageThread apiBaseUrl={apiBaseUrl} conversationId={selectedConversationId} />
        ) : (
          <section className="messages-p0-empty-panel hidden min-h-[calc(100dvh-190px)] items-center justify-center rounded-[1.5rem] border border-border bg-background/80 p-8 text-center shadow-sm lg:flex">
          <div className="max-w-sm space-y-3">
            <div
              aria-hidden="true"
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm dark:bg-neutral-950"
            >
              &#9993;
            </div>
            <h2 className="text-xl font-black tracking-tight text-foreground">Bir konuşma seç</h2>

          </div>
        </section>
        )}
      </div>
    </PageContainer>
  );
}

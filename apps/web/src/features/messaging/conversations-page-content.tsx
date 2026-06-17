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
    <PageContainer className="max-w-7xl py-4 sm:py-6" ariaLabel="Mesajlar">
      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section
          className={[
            "rounded-[1.75rem] border border-border bg-background/88 p-4 shadow-sm backdrop-blur sm:p-5 lg:h-[calc(100dvh-190px)] lg:min-h-[620px]",
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
          <section className="hidden min-h-[calc(100dvh-190px)] items-center justify-center rounded-[1.75rem] border border-border bg-gradient-to-br from-rose-50/80 via-background to-teal-50/70 p-8 text-center shadow-sm dark:from-rose-950/20 dark:via-background dark:to-teal-950/20 lg:flex">
          <div className="max-w-sm space-y-3">
            <div
              aria-hidden="true"
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm dark:bg-neutral-950"
            >
              &#9993;
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">Bir konuşma seç</h2>
            <p className="text-sm font-semibold leading-6 text-muted-foreground">
              İlanla ilgili soruları ve yanıtları burada takip edebilirsin.
            </p>
          </div>
        </section>
        )}
      </div>
    </PageContainer>
  );
}

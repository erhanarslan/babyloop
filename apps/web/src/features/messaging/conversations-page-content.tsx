"use client";

import Link from "next/link";

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
    <PageContainer
      ariaLabel="Mesajlar"
      className="messages-p0-page max-w-7xl py-4 sm:py-6"
    >
      <div className="messages-p0-layout grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section
          className={[
            "messages-p0-list-panel rounded-[1.5rem] border border-border bg-background/88 p-3 shadow-sm backdrop-blur sm:p-4 lg:h-[calc(100dvh-190px)] lg:min-h-[620px]",
            hasSelectedConversation ? "hidden lg:block" : ""
          ].join(" ")}
        >
          <ConversationList
            apiBaseUrl={apiBaseUrl}
            getConversationHref={(conversationId) =>
              `/conversations?conversationId=${encodeURIComponent(conversationId)}`
            }
            selectedConversationId={selectedConversationId}
          />
        </section>

        {selectedConversationId ? (
          <MessageThread
            apiBaseUrl={apiBaseUrl}
            conversationId={selectedConversationId}
          />
        ) : (
          <MessagesStartPanel />
        )}
      </div>
    </PageContainer>
  );
}

function MessagesStartPanel() {
  return (
    <section
      aria-labelledby="messages-start-title"
      className="messages-p0-empty-panel messages-start-panel hidden min-h-[calc(100dvh-190px)] items-center justify-center rounded-[1.5rem] border border-border p-8 text-center shadow-sm lg:flex"
    >
      <div className="messages-start-content">
        <div aria-hidden="true" className="messages-start-visual">
          <span className="messages-start-bubble messages-start-bubble-primary">
            <MessageIcon />
          </span>
          <span className="messages-start-bubble messages-start-bubble-secondary">
            <CheckIcon />
          </span>
        </div>

        <div>
          <p className="eyebrow">Mesajlar</p>
          <h2 id="messages-start-title">Bir konuşma seç</h2>
          <p className="messages-start-description">
            Soldaki listeden bir konuşmayı aç.
          </p>
        </div>

        <div className="messages-start-actions">
          <Link href="/browse">İlanları keşfet</Link>
          <span>
            Yeni konuşmalar ilan detayındaki “Satıcıya yaz” ile başlar.
          </span>
        </div>

        <div className="messages-start-safety">
          <ShieldIcon />
          <div>
            <strong>Güvenli mesajlaşma</strong>
            <span>Yazışmayı BabyLoop içinde tut.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageIcon() {
  return (
    <svg
      fill="none"
      height="26"
      viewBox="0 0 24 24"
      width="26"
    >
      <path
        d="M5.5 17.5 3 20v-5.25A8 8 0 0 1 4 4.5h16v11H8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M7.5 9h9M7.5 12h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="m6.5 12.5 3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="22"
      viewBox="0 0 24 24"
      width="22"
    >
      <path
        d="M12 3 5.5 5.7v5.2c0 4.3 2.6 7.8 6.5 9.1 3.9-1.3 6.5-4.8 6.5-9.1V5.7L12 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m9 11.5 2 2 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

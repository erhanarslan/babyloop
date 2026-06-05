"use client";

import { PageContainer, PageHeading } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { MessageThread } from "./message-thread";

type ConversationPageContentProps = {
  apiBaseUrl: string;
  conversationId: string;
};

export function ConversationPageContent({
  apiBaseUrl,
  conversationId
}: ConversationPageContentProps) {
  const { dictionary } = useI18n();

  return (
    <>
      <PageHeading
        eyebrow={dictionary.messaging.eyebrow}
        title={dictionary.messaging.conversationTitle}
      />
      <PageContainer className="conversations-layout">
        <MessageThread apiBaseUrl={apiBaseUrl} conversationId={conversationId} />
      </PageContainer>
    </>
  );
}

"use client";

import { PageContainer, PageHeading } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { ConversationList } from "./conversation-list";

type ConversationsPageContentProps = {
  apiBaseUrl: string;
};

export function ConversationsPageContent({ apiBaseUrl }: ConversationsPageContentProps) {
  const { dictionary } = useI18n();

  return (
    <>
      <PageHeading
        eyebrow={dictionary.messaging.eyebrow}
        title={dictionary.messaging.conversationsTitle}
        description={dictionary.messaging.conversationsDescription}
      />
      <PageContainer className="conversations-layout">
        <ConversationList apiBaseUrl={apiBaseUrl} />
      </PageContainer>
    </>
  );
}

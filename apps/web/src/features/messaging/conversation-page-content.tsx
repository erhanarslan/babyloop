"use client";

import Link from "next/link";
import { Card, PageContainer, PageHeading } from "../../components/ui";
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
        description="Use this private thread for listing-specific questions, pickup details, and safer handover decisions."
      />
      <PageContainer className="messaging-thread-layout conversations-layout">
        <Card as="section" className="thread-context-hero" aria-label="Conversation safety context">
          <div>
            <p className="eyebrow">Private thread</p>
            <h2>Ask clear questions before committing.</h2>
            <p>
              Messages are visible only to conversation participants. Keep the thread focused on the item,
              condition, included parts, timing, and handover expectations.
            </p>
          </div>
          <div className="thread-context-actions">
            <Link href="/conversations">{dictionary.messaging.backToMessages}</Link>
            <Link href="/assistant?mode=safe_buying&prompt=Give%20me%20a%20short%20safe%20buyer-seller%20message%20checklist.">
              Ask Assistant
            </Link>
          </div>
        </Card>

        <MessageThread apiBaseUrl={apiBaseUrl} conversationId={conversationId} />
      </PageContainer>
    </>
  );
}

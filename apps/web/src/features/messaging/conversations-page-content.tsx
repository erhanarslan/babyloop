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
        <section className="conversation-safety-overview" aria-label="Messaging safety overview">
          <div>
            <p className="eyebrow">Messaging safety</p>
            <h2>Talk through the details before deciding</h2>
            <p className="form-note">
              BabyLoop messages are for item questions, pickup expectations, and safety checks. Report or block when something feels wrong.
            </p>
          </div>
        </section>

        <ConversationList apiBaseUrl={apiBaseUrl} />
      </PageContainer>
    </>
  );
}

"use client";

import Link from "next/link";
import { Card, PageContainer, PageHeading } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { ConversationList } from "./conversation-list";

type ConversationsPageContentProps = {
  apiBaseUrl: string;
};

const messagingWorkflowSteps = [
  {
    title: "Context",
    body: "Start from a listing so both parents keep item title and intent attached to the thread."
  },
  {
    title: "Plain text",
    body: "Messages are moderated as safe plain text. HTML, scripts, spam, threats, and unsafe content are blocked."
  },
  {
    title: "Resolve",
    body: "Ask condition, photo, accessory, pickup, and availability questions before deciding."
  }
];

export function ConversationsPageContent({ apiBaseUrl }: ConversationsPageContentProps) {
  const { dictionary } = useI18n();

  return (
    <>
      <PageHeading
        eyebrow={dictionary.messaging.eyebrow}
        title={dictionary.messaging.conversationsTitle}
        description={dictionary.messaging.conversationsDescription}
      />
      <PageContainer className="messaging-experience-layout conversations-layout">
        <Card as="section" className="messaging-hero" aria-label="Messaging workspace overview">
          <div>
            <p className="eyebrow">Buyer-seller messaging</p>
            <h2>Keep every marketplace conversation focused, safe, and actionable.</h2>
            <p>
              BabyLoop conversations are private participant-only threads for listing questions,
              pickup expectations, availability, and safer handover decisions.
            </p>
            <div className="messaging-hero-actions">
              <Link href="/browse">Browse listings</Link>
              <Link href="/favorites">Saved shortlist</Link>
              <Link href="/assistant?mode=safe_buying&prompt=Help%20me%20prepare%20safe%20buyer%20questions%20before%20messaging%20a%20seller.">
                Ask buyer assistant
              </Link>
            </div>
          </div>

          <aside className="messaging-hero-principles" aria-label="Messaging principles">
            <div>
              <span>Private</span>
              <strong>Conversation participants only</strong>
            </div>
            <div>
              <span>Safe text</span>
              <strong>No HTML, scripts, threats, or spam</strong>
            </div>
            <div>
              <span>Actionable</span>
              <strong>Condition, photos, pickup, availability</strong>
            </div>
          </aside>
        </Card>

        <section className="messaging-workflow-grid" aria-label="Messaging workflow">
          {messagingWorkflowSteps.map((step, index) => (
            <Card as="article" className="messaging-workflow-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </Card>
          ))}
        </section>

        <section className="conversation-safety-overview messaging-safety-overview" aria-label="Messaging safety overview">
          <div>
            <p className="eyebrow">Messaging safety</p>
            <h2>Talk through the details before deciding</h2>
            <p className="form-note">
              Keep the discussion inside BabyLoop. Ask item-specific questions, avoid unnecessary private details,
              and use report or block controls when something feels wrong.
            </p>
          </div>
          <div className="messaging-safety-points" aria-label="Safe messaging checklist">
            <span>Ask about condition</span>
            <span>Confirm included parts</span>
            <span>Check pickup expectations</span>
            <span>Report unsafe behavior</span>
          </div>
        </section>

        <ConversationList apiBaseUrl={apiBaseUrl} />
      </PageContainer>
    </>
  );
}

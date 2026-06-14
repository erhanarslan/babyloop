import { EmptyState, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function ConversationNotFound() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Conversation not found"
          description="This message thread is unavailable, blocked, or you no longer have access."
        />
        <EmptyState
          title="Conversation not found"
          message="This message thread is unavailable, blocked, or you no longer have access."
          actionHref="/conversations"
          actionLabel="Back to conversations"
        />
      </PageContainer>
    </SiteShell>
  );
}

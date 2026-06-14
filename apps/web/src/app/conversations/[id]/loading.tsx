import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function ConversationThreadLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading conversation"
          description="Fetching the selected message thread safely."
        />
        <LoadingBlock
          title="Loading conversation"
          message="Fetching the selected message thread safely."
        />
      </PageContainer>
    </SiteShell>
  );
}

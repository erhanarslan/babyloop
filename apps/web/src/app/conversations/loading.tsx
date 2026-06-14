import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function ConversationsLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading conversations"
          description="Checking your marketplace message threads."
        />
        <LoadingBlock
          title="Loading conversations"
          message="Checking your marketplace message threads."
        />
      </PageContainer>
    </SiteShell>
  );
}

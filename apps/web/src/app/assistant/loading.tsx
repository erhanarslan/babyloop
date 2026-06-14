import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function AssistantLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading assistant"
          description="Preparing marketplace guidance and safety boundaries."
        />
        <LoadingBlock
          title="Loading assistant"
          message="Preparing marketplace guidance and safety boundaries."
        />
      </PageContainer>
    </SiteShell>
  );
}

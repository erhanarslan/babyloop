import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function GuidesLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading parent guides"
          description="Preparing marketplace and lifecycle guide topics."
        />
        <LoadingBlock
          title="Loading parent guides"
          message="Preparing marketplace and lifecycle guide topics."
        />
      </PageContainer>
    </SiteShell>
  );
}

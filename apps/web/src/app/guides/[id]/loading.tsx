import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function GuideDetailLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading guide"
          description="Preparing the selected parent guide."
        />
        <LoadingBlock
          title="Loading guide"
          message="Preparing the selected parent guide."
        />
      </PageContainer>
    </SiteShell>
  );
}

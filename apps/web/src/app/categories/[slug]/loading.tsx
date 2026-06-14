import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function CategoryLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading category"
          description="Fetching category listings and filters."
        />
        <LoadingBlock
          title="Loading category"
          message="Fetching category listings and filters."
        />
      </PageContainer>
    </SiteShell>
  );
}

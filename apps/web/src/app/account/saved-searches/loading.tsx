import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function SavedSearchesLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading saved searches"
          description="Checking your saved marketplace filters."
        />
        <LoadingBlock
          title="Loading saved searches"
          message="Checking your saved marketplace filters."
        />
      </PageContainer>
    </SiteShell>
  );
}

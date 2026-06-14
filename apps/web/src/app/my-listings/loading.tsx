import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function MyListingsLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading your listings"
          description="Fetching your marketplace listings and actions."
        />
        <LoadingBlock
          title="Loading your listings"
          message="Fetching your marketplace listings and actions."
        />
      </PageContainer>
    </SiteShell>
  );
}

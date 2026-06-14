import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function FavoritesLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading favorites"
          description="Fetching your saved marketplace listings."
        />
        <LoadingBlock
          title="Loading favorites"
          message="Fetching your saved marketplace listings."
        />
      </PageContainer>
    </SiteShell>
  );
}

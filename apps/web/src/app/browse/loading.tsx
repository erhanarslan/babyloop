import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function BrowseLoading() {
  return (
    <SiteShell>
      <PageHeading eyebrow="Browse marketplace" title="Loading listings" />
      <PageContainer>
        <LoadingBlock
          title="Fetching marketplace data"
          message="Reading active listings and categories from the BabyLoop API."
        />
      </PageContainer>
    </SiteShell>
  );
}

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function ListingDetailLoading() {
  return (
    <SiteShell>
      <PageHeading eyebrow="Listing detail" title="Loading listing" />
      <PageContainer>
        <LoadingBlock title="Fetching listing detail" message="Reading this listing from the BabyLoop API." />
      </PageContainer>
    </SiteShell>
  );
}

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function SellLoading() {
  return (
    <SiteShell>
      <PageHeading eyebrow="Sell on BabyLoop" title="Loading listing form" />
      <PageContainer>
        <LoadingBlock title="Preparing form" message="Loading categories and form options." />
      </PageContainer>
    </SiteShell>
  );
}

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function SellerDashboardLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading seller dashboard"
          description="Preparing listing insights and seller metrics."
        />
        <LoadingBlock
          title="Loading seller dashboard"
          message="Preparing listing insights and seller metrics."
        />
      </PageContainer>
    </SiteShell>
  );
}

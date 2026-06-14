import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function AccountChildrenLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading child profiles"
          description="Checking family profile settings and lifecycle suggestions."
        />
        <LoadingBlock
          title="Loading child profiles"
          message="Checking family profile settings and lifecycle suggestions."
        />
      </PageContainer>
    </SiteShell>
  );
}

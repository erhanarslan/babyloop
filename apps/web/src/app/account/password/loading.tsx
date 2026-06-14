import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function AccountPasswordLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading password settings"
          description="Preparing account security controls."
        />
        <LoadingBlock
          title="Loading password settings"
          message="Preparing account security controls."
        />
      </PageContainer>
    </SiteShell>
  );
}

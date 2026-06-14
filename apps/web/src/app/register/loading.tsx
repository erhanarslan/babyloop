import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function RegisterLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading registration"
          description="Preparing account creation controls."
        />
        <LoadingBlock
          title="Loading registration"
          message="Preparing account creation controls."
        />
      </PageContainer>
    </SiteShell>
  );
}

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function ForgotPasswordLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading password reset"
          description="Preparing password reset request controls."
        />
        <LoadingBlock
          title="Loading password reset"
          message="Preparing password reset request controls."
        />
      </PageContainer>
    </SiteShell>
  );
}

import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function ResetPasswordLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading password reset"
          description="Checking password reset controls."
        />
        <LoadingBlock
          title="Loading password reset"
          message="Checking password reset controls."
        />
      </PageContainer>
    </SiteShell>
  );
}

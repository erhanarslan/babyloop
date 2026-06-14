import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function VerifyEmailLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Checking verification link"
          description="Validating the email verification request."
        />
        <LoadingBlock
          title="Checking verification link"
          message="Validating the email verification request."
        />
      </PageContainer>
    </SiteShell>
  );
}

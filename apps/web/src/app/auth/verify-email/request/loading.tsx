import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../../components/ui";

export default function VerifyEmailRequestLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading verification request"
          description="Preparing email verification controls."
        />
        <LoadingBlock
          title="Loading verification request"
          message="Preparing email verification controls."
        />
      </PageContainer>
    </SiteShell>
  );
}

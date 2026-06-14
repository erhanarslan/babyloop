import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function LoginLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading sign in"
          description="Preparing secure sign-in controls."
        />
        <LoadingBlock
          title="Loading sign in"
          message="Preparing secure sign-in controls."
        />
      </PageContainer>
    </SiteShell>
  );
}

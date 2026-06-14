import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";

export default function NotificationsLoading() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Loading notifications"
          description="Fetching marketplace updates safely."
        />
        <LoadingBlock
          title="Loading notifications"
          message="Fetching marketplace updates safely."
        />
      </PageContainer>
    </SiteShell>
  );
}

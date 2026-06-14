import { EmptyState, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function GuideNotFound() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Guide not found"
          description="This parent guide is unavailable or has moved."
        />
        <EmptyState
          title="Guide not found"
          message="This parent guide is unavailable or has moved."
          actionHref="/guides"
          actionLabel="Browse guides"
        />
      </PageContainer>
    </SiteShell>
  );
}

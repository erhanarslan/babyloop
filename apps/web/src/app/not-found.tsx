import { EmptyState, PageContainer, PageHeading, SiteShell } from "../components/ui";

export default function GlobalNotFound() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Page not found"
          description="The page you are looking for is unavailable or has moved."
        />
        <EmptyState
          title="Page not found"
          message="The page you are looking for is unavailable or has moved."
          actionHref="/"
          actionLabel="Go home"
        />
      </PageContainer>
    </SiteShell>
  );
}

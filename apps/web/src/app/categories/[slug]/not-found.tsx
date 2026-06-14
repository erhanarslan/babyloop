import { EmptyState, PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function CategoryNotFound() {
  return (
    <SiteShell>
      <PageContainer>
        <PageHeading
          eyebrow="BabyLoop"
          title="Category not found"
          description="This category is unavailable or no longer published."
        />
        <EmptyState
          title="Category not found"
          message="This category is unavailable or no longer published."
          actionHref="/browse"
          actionLabel="Browse listings"
        />
      </PageContainer>
    </SiteShell>
  );
}

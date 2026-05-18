import Link from "next/link";
import { PageContainer, PageHeading, SiteShell } from "../../../components/ui";

export default function ListingNotFound() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Listing detail"
        title="Listing not found"
        description="The listing may be inactive, removed, or not available in the current seed data."
      />
      <PageContainer>
        <Link className="primary-link" href="/browse">
          Back to browse
        </Link>
      </PageContainer>
    </SiteShell>
  );
}

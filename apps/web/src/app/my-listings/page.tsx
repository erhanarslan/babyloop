import { PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { MyListingsList } from "../../features/listings/my-listings-list";
import { getApiBaseUrl } from "../../lib/api";

export default function MyListingsPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Seller workspace"
        title="My listings"
        description="View listings owned by your logged-in BabyLoop profile."
      />

      <PageContainer className="listing-column" ariaLabel="My listings">
        <MyListingsList apiBaseUrl={getApiBaseUrl()} />
      </PageContainer>
    </SiteShell>
  );
}

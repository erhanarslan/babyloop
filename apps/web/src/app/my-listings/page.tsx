import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { SiteShell } from "../../components/ui";
import { MyListingsPageContent } from "../../features/listings/my-listings-page-content";
import { getApiBaseUrl } from "../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "My listings",
  "BabyLoop seller listing management pages are private and not indexed."
);

export default function MyListingsPage() {
  return (
    <SiteShell>
      <MyListingsPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

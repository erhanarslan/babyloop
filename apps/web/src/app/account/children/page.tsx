import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { SiteShell } from "../../../components/ui";
import { ChildProfilesPageContent } from "../../../features/child-profiles/child-profiles-page-content";
import { getApiBaseUrl } from "../../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Child profiles",
  "BabyLoop account child profile pages are private and not indexed."
);

export default function AccountChildrenPage() {
  return (
    <SiteShell>
      <ChildProfilesPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

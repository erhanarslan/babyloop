import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { SiteShell } from "../../../components/ui";
import { SavedSearchesPageContent } from "../../../features/saved-searches/saved-searches-page-content";
import { getApiBaseUrl } from "../../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Saved searches",
  "BabyLoop saved search pages are private and not indexed."
);

export default function AccountSavedSearchesPage() {
  return (
    <SiteShell>
      <SavedSearchesPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

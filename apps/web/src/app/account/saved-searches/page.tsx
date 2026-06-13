import { SiteShell } from "../../../components/ui";
import { SavedSearchesPageContent } from "../../../features/saved-searches/saved-searches-page-content";
import { getApiBaseUrl } from "../../../lib/api";

export default function AccountSavedSearchesPage() {
  return (
    <SiteShell>
      <SavedSearchesPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

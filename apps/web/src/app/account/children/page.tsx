import { SiteShell } from "../../../components/ui";
import { ChildProfilesPageContent } from "../../../features/child-profiles/child-profiles-page-content";
import { getApiBaseUrl } from "../../../lib/api";

export default function AccountChildrenPage() {
  return (
    <SiteShell>
      <ChildProfilesPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

import { SiteShell } from "../../components/ui";
import { MyListingsPageContent } from "../../features/listings/my-listings-page-content";
import { getApiBaseUrl } from "../../lib/api";

export default function MyListingsPage() {
  return (
    <SiteShell>
      <MyListingsPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

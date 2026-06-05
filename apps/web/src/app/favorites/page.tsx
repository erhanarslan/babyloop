import { SiteShell } from "../../components/ui";
import { FavoritesPageContent } from "../../features/favorites/favorites-page-content";
import { getApiBaseUrl } from "../../lib/api";

export default function FavoritesPage() {
  return (
    <SiteShell>
      <FavoritesPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

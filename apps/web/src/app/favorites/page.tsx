import { SiteShell, PageContainer } from "../../components/ui";
import { FavoritesList } from "../../features/favorites/favorites-list";
import { getApiBaseUrl } from "../../lib/api";

export default function FavoritesPage() {
  return (
    <SiteShell>
      <PageContainer className="favorites-page pb-12 pt-5" ariaLabel="Favoriler">
        <FavoritesList apiBaseUrl={getApiBaseUrl()} />
      </PageContainer>
    </SiteShell>
  );
}

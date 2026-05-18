import { PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { FavoritesList } from "../../features/favorites/favorites-list";
import { getApiBaseUrl } from "../../lib/api";

export default function FavoritesPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Your profile"
        title="Saved listings"
        description="Favorites are connected to your logged-in BabyLoop profile."
      />

      <PageContainer className="listing-column" ariaLabel="Favorite listings">
        <FavoritesList apiBaseUrl={getApiBaseUrl()} />
      </PageContainer>
    </SiteShell>
  );
}

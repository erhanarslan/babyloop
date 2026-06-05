import { SiteShell } from "../components/ui";
import { HomePageContent } from "../features/home/home-page-content";
import { getApiBaseUrl } from "../lib/api";

export default function HomePage() {
  return (
    <SiteShell>
      <HomePageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

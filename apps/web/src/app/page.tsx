import type { Metadata } from "next";
import { SiteShell } from "../components/ui";
import { HomePageContent } from "../features/home/home-page-content";
import { getApiBaseUrl } from "../lib/api";
import { buildPublicPageMetadata } from "../lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Parent marketplace for baby and child essentials",
  description:
    "Buy, sell, donate, and reuse baby essentials with parent-owned listings, safer conversations, child age-band planning, and BabyLoop Assistant guidance.",
  path: "/"
});

export default function HomePage() {
  return (
    <SiteShell>
      <HomePageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

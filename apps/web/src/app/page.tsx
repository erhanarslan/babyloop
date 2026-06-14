import type { Metadata } from "next";
import { SiteShell } from "../components/ui";
import { HomePageContent } from "../features/home/home-page-content";
import { getApiBaseUrl } from "../lib/api";
import { buildPublicPageMetadata } from "../lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Trusted baby marketplace, parent guides, and AI-assisted discovery",
  description:
    "BabyLoop is a parent-focused marketplace for buying, selling, donating, and reusing baby essentials with safer messaging, lifecycle planning, saved searches, and AI-assisted guidance.",
  path: "/"
});

export default function HomePage() {
  return (
    <SiteShell>
      <HomePageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

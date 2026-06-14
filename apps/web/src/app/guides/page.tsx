import type { Metadata } from "next";
import { SiteShell } from "../../components/ui";
import { ParentGuidesPageContent } from "../../features/parent-guides/parent-guides-page-content";
import { buildPublicPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Parent buying guides",
  description:
    "Read BabyLoop parent guides for age-band planning, second-hand buying checks, safer listing questions, and practical marketplace discovery.",
  path: "/guides"
});

export default function GuidesPage() {
  return (
    <SiteShell>
      <ParentGuidesPageContent />
    </SiteShell>
  );
}

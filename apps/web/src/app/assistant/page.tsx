import type { Metadata } from "next";
import { SiteShell } from "../../components/ui";
import { AssistantPageContent } from "../../features/assistant/assistant-page-content";
import { getApiBaseUrl } from "../../lib/api";
import { buildPublicPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "BabyLoop Assistant",
  description:
    "Use BabyLoop Assistant for marketplace-focused product discovery, seller listing preparation, safer second-hand buying checks, and age-band planning.",
  path: "/assistant"
});

export default function AssistantPage() {
  return (
    <SiteShell>
      <AssistantPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

import type { Metadata } from "next";
import { SiteShell } from "../../components/ui";
import { AssistantPageContent } from "../../features/assistant/assistant-page-content";
import { getApiBaseUrl } from "../../lib/api";
import { buildPublicPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "BabyLoop Asistan",
  description:
    "BabyLoop Asistan ile ürün, ilan ve ebeveynlik sorularını kısa ve anlaşılır şekilde sor.",
  path: "/assistant"
});

export default function AssistantPage() {
  return (
    <SiteShell>
      <AssistantPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

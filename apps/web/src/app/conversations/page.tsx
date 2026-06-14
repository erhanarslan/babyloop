import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { SiteShell } from "../../components/ui";
import { ConversationsPageContent } from "../../features/messaging/conversations-page-content";
import { getApiBaseUrl } from "../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Messages",
  "BabyLoop message pages are private and not indexed."
);

export default function ConversationsPage() {
  return (
    <SiteShell>
      <ConversationsPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

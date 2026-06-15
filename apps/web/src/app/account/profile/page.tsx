import type { Metadata } from "next";
import { SiteShell } from "../../../components/ui";
import { AccountProfilePageContent } from "../../../features/account/account-profile-page-content";
import { getApiBaseUrl } from "../../../lib/api";
import { buildNoIndexMetadata } from "../../../lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Account profile",
  "BabyLoop account profile pages are private and not indexed."
);

export default function AccountProfilePage() {
  return (
    <SiteShell>
      <AccountProfilePageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

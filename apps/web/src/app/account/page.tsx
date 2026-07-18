import type { Metadata } from "next";
import { SiteShell } from "../../components/ui";
import { AccountDeletionPanel } from "../../features/account/account-deletion-panel";
import { AccountProfilePageContent } from "../../features/account/account-profile-page-content";
import { getApiBaseUrl } from "../../lib/api";
import { buildNoIndexMetadata } from "../../lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Hesabım",
  "BabyLoop hesap sayfaları özel alandır ve indekslenmez."
);

export default function AccountPage() {
  return (
    <SiteShell>
      <AccountProfilePageContent apiBaseUrl={getApiBaseUrl()} />
      <AccountDeletionPanel apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

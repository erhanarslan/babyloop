import type { Metadata } from "next";

import { SiteShell } from "../../../components/ui";
import { AccountSecurityPageContent } from "../../../features/account/account-security-page-content";
import { getApiBaseUrl } from "../../../lib/api";
import { buildNoIndexMetadata } from "../../../lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Hesap güvenliği",
  "BabyLoop şifre, OTP / MFA ve aktif oturum ayarları özel alandır ve indekslenmez."
);

export default function AccountSecurityPage() {
  return (
    <SiteShell>
      <AccountSecurityPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

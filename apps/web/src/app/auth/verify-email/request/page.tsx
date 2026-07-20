import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../../lib/seo";
import { SiteShell } from "../../../../components/ui";
import { EmailVerificationRequestPageContent } from "../../../../features/auth/email-verification-request-page-content";
import { getApiBaseUrl } from "../../../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "E-posta doğrulama",
  "BabyLoop e-posta doğrulama bağlantısı iste."
);

export default function RequestEmailVerificationPage() {
  return (
    <SiteShell>
      <EmailVerificationRequestPageContent apiBaseUrl={getApiBaseUrl()} />
    </SiteShell>
  );
}

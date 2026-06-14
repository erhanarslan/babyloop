import { SiteShell } from "../../../../components/ui";
import { AuthLinkNote } from "../../../../features/auth/auth-link-note";
import { AuthPageShell } from "../../../../features/auth/auth-page-shell";
import { RequestEmailVerificationForm } from "../../../../features/auth/request-email-verification-form";
import { getApiBaseUrl } from "../../../../lib/api";
import { AuthSurfaceGuide } from "../../../../features/auth/auth-surface-guide";

export default function RequestEmailVerificationPage() {
  return (
    <SiteShell>
      <AuthSurfaceGuide kind="verify" />
      <AuthPageShell ariaLabel="Email verification request" kind="requestVerify">
        <RequestEmailVerificationForm apiBaseUrl={getApiBaseUrl()} />
        <AuthLinkNote kind="verified" />
      </AuthPageShell>
    </SiteShell>
  );
}

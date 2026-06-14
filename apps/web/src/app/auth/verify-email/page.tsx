import { Suspense } from "react";
import { SiteShell } from "../../../components/ui";
import { AuthLoadingBlock } from "../../../features/auth/auth-loading-block";
import { AuthPageShell } from "../../../features/auth/auth-page-shell";
import { VerifyEmailForm } from "../../../features/auth/verify-email-form";
import { getApiBaseUrl } from "../../../lib/api";
import { AuthSurfaceGuide } from "../../../features/auth/auth-surface-guide";

export default function VerifyEmailPage() {
  return (
    <SiteShell>
      <AuthSurfaceGuide kind="verify" />
      <AuthPageShell ariaLabel="Email verification" kind="verify">
        <Suspense
          fallback={
            <AuthLoadingBlock kind="verify" />
          }
        >
          <VerifyEmailForm apiBaseUrl={getApiBaseUrl()} />
        </Suspense>
      </AuthPageShell>
    </SiteShell>
  );
}

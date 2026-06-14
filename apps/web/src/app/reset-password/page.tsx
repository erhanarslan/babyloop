import { Suspense } from "react";
import { SiteShell } from "../../components/ui";
import { AuthLoadingBlock } from "../../features/auth/auth-loading-block";
import { AuthPageShell } from "../../features/auth/auth-page-shell";
import { ResetPasswordForm } from "../../features/auth/reset-password-form";
import { getApiBaseUrl } from "../../lib/api";
import { AuthSurfaceGuide } from "../../features/auth/auth-surface-guide";

export default function ResetPasswordPage() {
  return (
    <SiteShell>
      <AuthSurfaceGuide kind="reset_password" />
      <AuthPageShell ariaLabel="Reset password form" kind="reset">
        <Suspense
          fallback={
            <AuthLoadingBlock kind="reset" />
          }
        >
          <ResetPasswordForm apiBaseUrl={getApiBaseUrl()} />
        </Suspense>
      </AuthPageShell>
    </SiteShell>
  );
}

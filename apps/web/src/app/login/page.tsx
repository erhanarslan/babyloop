import { Suspense } from "react";
import { SiteShell } from "../../components/ui";
import { AuthLinkNote } from "../../features/auth/auth-link-note";
import { AuthPageShell } from "../../features/auth/auth-page-shell";
import { AuthErrorNotice } from "../../features/auth/auth-error-notice";
import { AuthForm } from "../../features/auth/auth-form";
import { getApiBaseUrl } from "../../lib/api";

export default function LoginPage() {
  return (
    <SiteShell>
      <AuthPageShell ariaLabel="Login form" kind="login">
        <Suspense fallback={null}>
          <AuthErrorNotice />
        </Suspense>
        <AuthForm apiBaseUrl={getApiBaseUrl()} mode="login" />
        <AuthLinkNote kind="noAccount" />
        <AuthLinkNote kind="forgotPassword" />
      </AuthPageShell>
    </SiteShell>
  );
}

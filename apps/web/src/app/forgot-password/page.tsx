import { SiteShell } from "../../components/ui";
import { AuthLinkNote } from "../../features/auth/auth-link-note";
import { AuthPageShell } from "../../features/auth/auth-page-shell";
import { ForgotPasswordForm } from "../../features/auth/forgot-password-form";
import { getApiBaseUrl } from "../../lib/api";
import { AuthSurfaceGuide } from "../../features/auth/auth-surface-guide";

export default function ForgotPasswordPage() {
  return (
    <SiteShell>
      <AuthSurfaceGuide kind="forgot_password" />
      <AuthPageShell ariaLabel="Forgot password form" kind="forgot">
        <ForgotPasswordForm apiBaseUrl={getApiBaseUrl()} />
        <AuthLinkNote kind="rememberedPassword" />
      </AuthPageShell>
    </SiteShell>
  );
}

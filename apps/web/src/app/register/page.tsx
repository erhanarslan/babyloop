import { SiteShell } from "../../components/ui";
import { AuthLinkNote } from "../../features/auth/auth-link-note";
import { AuthPageShell } from "../../features/auth/auth-page-shell";
import { AuthForm } from "../../features/auth/auth-form";
import { getApiBaseUrl } from "../../lib/api";
import { AuthSurfaceGuide } from "../../features/auth/auth-surface-guide";

export default function RegisterPage() {
  return (
    <SiteShell>
      <AuthSurfaceGuide kind="register" />
      <AuthPageShell ariaLabel="Register form" kind="register">
        <AuthForm apiBaseUrl={getApiBaseUrl()} mode="register" />
        <AuthLinkNote kind="alreadyRegistered" />
      </AuthPageShell>
    </SiteShell>
  );
}

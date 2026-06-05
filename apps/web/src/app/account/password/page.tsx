import { SiteShell } from "../../../components/ui";
import { AuthPageShell } from "../../../features/auth/auth-page-shell";
import { ChangePasswordForm } from "../../../features/auth/change-password-form";
import { getApiBaseUrl } from "../../../lib/api";

export default function AccountPasswordPage() {
  return (
    <SiteShell>
      <AuthPageShell ariaLabel="Change password form" kind="password">
        <ChangePasswordForm apiBaseUrl={getApiBaseUrl()} />
      </AuthPageShell>
    </SiteShell>
  );
}

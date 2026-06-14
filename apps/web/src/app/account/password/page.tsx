import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { SiteShell } from "../../../components/ui";
import { AuthPageShell } from "../../../features/auth/auth-page-shell";
import { ChangePasswordForm } from "../../../features/auth/change-password-form";
import { getApiBaseUrl } from "../../../lib/api";
import { AuthSurfaceGuide } from "../../../features/auth/auth-surface-guide";

export const metadata: Metadata = buildNoIndexMetadata(
  "Change password",
  "BabyLoop password management pages are private and not indexed."
);

export default function AccountPasswordPage() {
  return (
    <SiteShell>
      <AuthSurfaceGuide kind="change_password" />
      <AuthPageShell ariaLabel="Change password form" kind="password">
        <ChangePasswordForm apiBaseUrl={getApiBaseUrl()} />
      </AuthPageShell>
    </SiteShell>
  );
}

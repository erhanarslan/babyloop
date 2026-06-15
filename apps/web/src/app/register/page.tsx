import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../lib/seo";
import { SiteShell } from "../../components/ui";
import { AuthLinkNote } from "../../features/auth/auth-link-note";
import { AuthPageShell } from "../../features/auth/auth-page-shell";
import { AuthForm } from "../../features/auth/auth-form";
import { getApiBaseUrl } from "../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Create account",
  "Create a BabyLoop account. Account pages are not indexed."
);

export default function RegisterPage() {
  return (
    <SiteShell>
      <AuthPageShell ariaLabel="Register form" kind="register">
        <AuthForm apiBaseUrl={getApiBaseUrl()} mode="register" />
        <AuthLinkNote kind="alreadyRegistered" />
      </AuthPageShell>
    </SiteShell>
  );
}

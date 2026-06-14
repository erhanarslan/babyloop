import type { Metadata } from "next";
import { buildNoIndexMetadata } from "../../../lib/seo";
import { Suspense } from "react";
import { SiteShell } from "../../../components/ui";
import { AuthLoadingBlock } from "../../../features/auth/auth-loading-block";
import { AuthPageShell } from "../../../features/auth/auth-page-shell";
import { AuthCallback } from "../../../features/auth/auth-callback";
import { getApiBaseUrl } from "../../../lib/api";

export const metadata: Metadata = buildNoIndexMetadata(
  "Signing in",
  "BabyLoop authentication callback pages are not indexed."
);

export default function AuthCallbackPage() {
  return (
    <SiteShell>
      <AuthPageShell ariaLabel="Auth callback" kind="callback">
        <Suspense
          fallback={
            <AuthLoadingBlock kind="callback" />
          }
        >
          <AuthCallback apiBaseUrl={getApiBaseUrl()} />
        </Suspense>
      </AuthPageShell>
    </SiteShell>
  );
}

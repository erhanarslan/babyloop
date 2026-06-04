import { Suspense } from "react";
import { LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";
import { AuthCallback } from "../../../features/auth/auth-callback";
import { getApiBaseUrl } from "../../../lib/api";

export default function AuthCallbackPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Account"
        title="Signing you in"
        description="Finalizing your BabyLoop session."
      />

      <PageContainer className="auth-layout" ariaLabel="Auth callback">
        <Suspense
          fallback={
            <LoadingBlock
              title="Completing login"
              message="BabyLoop is securely finishing your Google sign-in."
            />
          }
        >
          <AuthCallback apiBaseUrl={getApiBaseUrl()} />
        </Suspense>
      </PageContainer>
    </SiteShell>
  );
}

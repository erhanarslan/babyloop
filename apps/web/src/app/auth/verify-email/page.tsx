import { Suspense } from "react";
import { Card, LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../../components/ui";
import { VerifyEmailForm } from "../../../features/auth/verify-email-form";
import { getApiBaseUrl } from "../../../lib/api";

export default function VerifyEmailPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Account"
        title="Verify email"
        description="Confirm the email address linked to your BabyLoop account."
      />

      <PageContainer className="auth-layout" ariaLabel="Email verification">
        <Card className="form-panel auth-panel">
          <Suspense
            fallback={
              <LoadingBlock
                title="Loading verification"
                message="Checking the verification link parameters."
              />
            }
          >
            <VerifyEmailForm apiBaseUrl={getApiBaseUrl()} />
          </Suspense>
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

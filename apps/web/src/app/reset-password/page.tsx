import { Suspense } from "react";
import { Card, LoadingBlock, PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { ResetPasswordForm } from "../../features/auth/reset-password-form";
import { getApiBaseUrl } from "../../lib/api";

export default function ResetPasswordPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Account"
        title="Reset password"
        description="Choose a new password with your reset token."
      />

      <PageContainer className="auth-layout" ariaLabel="Reset password form">
        <Card className="form-panel auth-panel">
          <Suspense
            fallback={
              <LoadingBlock
                title="Loading reset form"
                message="Checking the reset link parameters."
              />
            }
          >
            <ResetPasswordForm apiBaseUrl={getApiBaseUrl()} />
          </Suspense>
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

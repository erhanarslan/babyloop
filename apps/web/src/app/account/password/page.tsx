import { Card, PageContainer, PageHeading, SiteShell } from "../../../components/ui";
import { ChangePasswordForm } from "../../../features/auth/change-password-form";
import { getApiBaseUrl } from "../../../lib/api";

export default function AccountPasswordPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Account"
        title="Change password"
        description="Update your password for email-based BabyLoop login."
      />

      <PageContainer className="auth-layout" ariaLabel="Change password form">
        <Card className="form-panel auth-panel">
          <ChangePasswordForm apiBaseUrl={getApiBaseUrl()} />
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

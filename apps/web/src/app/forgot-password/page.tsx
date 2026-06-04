import Link from "next/link";
import { Card, PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { ForgotPasswordForm } from "../../features/auth/forgot-password-form";
import { getApiBaseUrl } from "../../lib/api";

export default function ForgotPasswordPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Account"
        title="Forgot password"
        description="Prepare a password reset request for your BabyLoop account."
      />

      <PageContainer className="auth-layout" ariaLabel="Forgot password form">
        <Card className="form-panel auth-panel">
          <ForgotPasswordForm apiBaseUrl={getApiBaseUrl()} />
          <p className="form-note">
            Remembered your password? <Link href="/login">Back to login</Link>
          </p>
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

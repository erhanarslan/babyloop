import Link from "next/link";
import { Card, PageContainer, PageHeading, SiteShell } from "../../../../components/ui";
import { RequestEmailVerificationForm } from "../../../../features/auth/request-email-verification-form";
import { getApiBaseUrl } from "../../../../lib/api";

export default function RequestEmailVerificationPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Account"
        title="Request email verification"
        description="Prepare a verification request for your BabyLoop account."
      />

      <PageContainer className="auth-layout" ariaLabel="Email verification request">
        <Card className="form-panel auth-panel">
          <RequestEmailVerificationForm apiBaseUrl={getApiBaseUrl()} />
          <p className="form-note">
            Already verified? <Link href="/login">Back to login</Link>
          </p>
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

import Link from "next/link";
import { Card, PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { AuthForm } from "../../features/auth/auth-form";
import { getApiBaseUrl } from "../../lib/api";

export default function RegisterPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Account"
        title="Create account"
        description="Create a local BabyLoop user and linked marketplace profile."
      />

      <PageContainer className="auth-layout" ariaLabel="Register form">
        <Card className="form-panel auth-panel">
          <AuthForm apiBaseUrl={getApiBaseUrl()} mode="register" />
          <p className="form-note">
            Already registered? <Link href="/login">Login</Link>
          </p>
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

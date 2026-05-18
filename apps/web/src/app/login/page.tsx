import Link from "next/link";
import { Card, PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { AuthForm } from "../../features/auth/auth-form";
import { getApiBaseUrl } from "../../lib/api";

export default function LoginPage() {
  return (
    <SiteShell>
      <PageHeading
        eyebrow="Account"
        title="Login"
        description="Use your BabyLoop account to create listings and save favorites."
      />

      <PageContainer className="auth-layout" ariaLabel="Login form">
        <Card className="form-panel auth-panel">
          <AuthForm apiBaseUrl={getApiBaseUrl()} mode="login" />
          <p className="form-note">
            No account yet? <Link href="/register">Create one</Link>
          </p>
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

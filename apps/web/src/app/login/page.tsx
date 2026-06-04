import Link from "next/link";
import { Suspense } from "react";
import { Card, PageContainer, PageHeading, SiteShell } from "../../components/ui";
import { AuthErrorNotice } from "../../features/auth/auth-error-notice";
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
          <Suspense fallback={null}>
            <AuthErrorNotice />
          </Suspense>
          <AuthForm apiBaseUrl={getApiBaseUrl()} mode="login" />
          <p className="form-note">
            No account yet? <Link href="/register">Create one</Link>
          </p>
          <p className="form-note">
            Forgot your password? <Link href="/forgot-password">Request a reset</Link>
          </p>
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

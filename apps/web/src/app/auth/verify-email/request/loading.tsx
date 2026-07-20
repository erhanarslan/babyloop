import { Card, PageContainer, SiteShell } from "../../../../components/ui";

export default function VerifyEmailRequestLoading() {
  return (
    <SiteShell>
      <PageContainer className="email-verification-request-page">
        <Card as="section" className="email-verification-request-card" aria-live="polite">
          <div className="email-verification-request-skeleton" aria-hidden="true" />
          <p className="text-center text-sm text-muted-foreground">
            E-posta doğrulama alanı hazırlanıyor…
          </p>
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

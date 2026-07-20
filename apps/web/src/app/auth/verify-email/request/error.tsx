"use client";

import { Button, Card, PageContainer, SiteShell } from "../../../../components/ui";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function VerifyEmailRequestError({ error: _error, reset }: RouteErrorProps) {
  return (
    <SiteShell>
      <PageContainer className="email-verification-request-page" ariaLabel="E-posta doğrulama hatası">
        <Card as="section" className="email-verification-request-card" role="alert">
          <header className="email-verification-request-heading">
            <p className="eyebrow">BabyLoop</p>
            <h1>Sayfa şu anda açılamadı</h1>
            <p>E-posta doğrulama alanını yeniden yükleyebilirsin.</p>
          </header>
          <Button className="w-full" type="button" onClick={() => reset()}>
            Tekrar dene
          </Button>
        </Card>
      </PageContainer>
    </SiteShell>
  );
}

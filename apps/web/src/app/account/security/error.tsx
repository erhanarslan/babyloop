"use client";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AccountSecurityError({
  error: _error,
  reset
}: RouteErrorProps) {
  return (
    <main className="page-container" role="alert">
      <section className="empty-state">
        <p className="eyebrow">Hesap güvenliği</p>
        <h1>Güvenlik merkezi yüklenemedi</h1>
        <p>Şifre, OTP / MFA ve oturum ayarları şu anda gösterilemiyor.</p>
        <button className="button-primary" type="button" onClick={() => reset()}>
          Tekrar dene
        </button>
      </section>
    </main>
  );
}

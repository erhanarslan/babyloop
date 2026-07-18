"use client";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ForgotPasswordError({ error: _error, reset }: RouteErrorProps) {
  return (
    <main className="page-container" role="alert">
      <section className="empty-state">
        <p className="eyebrow">BabyLoop</p>
        <h1>Password reset request could not load</h1>
        <p>The forgot password flow hit an unexpected error.</p>
        <button className="button-primary" type="button" onClick={() => reset()}>
          Tekrar dene
        </button>
      </section>
    </main>
  );
}

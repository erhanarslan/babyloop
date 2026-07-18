"use client";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function LoginError({ error: _error, reset }: RouteErrorProps) {
  return (
    <main className="page-container" role="alert">
      <section className="empty-state">
        <p className="eyebrow">BabyLoop</p>
        <h1>Sign in could not load</h1>
        <p>The sign-in flow hit an unexpected error.</p>
        <button className="button-primary" type="button" onClick={() => reset()}>
          Tekrar dene
        </button>
      </section>
    </main>
  );
}

"use client";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AccountPasswordError({ error: _error, reset }: RouteErrorProps) {
  return (
    <main className="page-container" role="alert">
      <section className="empty-state">
        <p className="eyebrow">BabyLoop</p>
        <h1>Password settings could not load</h1>
        <p>The account security area hit an unexpected error.</p>
        <button className="button-primary" type="button" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}

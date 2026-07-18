"use client";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SellError({ error: _error, reset }: RouteErrorProps) {
  return (
    <main className="page-container" role="alert">
      <section className="empty-state">
        <p className="eyebrow">BabyLoop</p>
        <h1>Sell form could not load</h1>
        <p>The listing creation flow hit an unexpected error.</p>
        <button className="button-primary" type="button" onClick={() => reset()}>
          Tekrar dene
        </button>
      </section>
    </main>
  );
}

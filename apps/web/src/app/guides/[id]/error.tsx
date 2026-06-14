"use client";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GuideDetailError({ error: _error, reset }: RouteErrorProps) {
  return (
    <main className="page-container" role="alert">
      <section className="empty-state">
        <p className="eyebrow">BabyLoop</p>
        <h1>Guide could not load</h1>
        <p>The selected parent guide hit an unexpected error.</p>
        <button className="button-primary" type="button" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}

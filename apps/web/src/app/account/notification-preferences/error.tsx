"use client";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function NotificationPreferencesError({ error: _error, reset }: RouteErrorProps) {
  return (
    <main className="page-container" role="alert">
      <section className="empty-state">
        <p className="eyebrow">BabyLoop</p>
        <h1>Bildirim tercihleri yüklenemedi</h1>
        <p>Bildirim tercihleri alanı şu an gösterilemiyor.</p>
        <button className="button-primary" type="button" onClick={() => reset()}>
          Tekrar dene
        </button>
      </section>
    </main>
  );
}

"use client";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ConversationsError({ error: _error, reset }: RouteErrorProps) {
  return (
    <main className="page-container" role="alert">
      <section className="empty-state">
        <p className="eyebrow">BabyLoop</p>
        <h1>Mesajlar yüklenemedi</h1>
        <p>Konuşmalar açılırken beklenmeyen bir hata oluştu.</p>
        <button className="button-primary" type="button" onClick={() => reset()}>
          Tekrar dene
        </button>
      </section>
    </main>
  );
}

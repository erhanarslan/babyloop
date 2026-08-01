type StatePanelProps = {
  description?: string;
  onRetry?: () => void;
  title: string;
};

export function LoadingState({ title = "Veriler yükleniyor…" }: { title?: string }) {
  return <div className="state-panel" aria-live="polite">{title}</div>;
}

export function EmptyState({ description, title }: StatePanelProps) {
  return (
    <div className="state-panel">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function RecoverableError({
  description = "İstek tamamlanamadı. Güvenli biçimde yeniden deneyebilirsin.",
  onRetry,
  title
}: StatePanelProps) {
  return (
    <div className="state-panel danger" role="alert">
      <strong>{title}</strong>
      <p>{description}</p>
      {onRetry ? <button className="secondary-action" onClick={onRetry} type="button">Tekrar dene</button> : null}
    </div>
  );
}

export function PermissionDeniedState() {
  return <RecoverableError title="Bu alanı görüntüleme yetkin yok" description="Erişim düzeyini yöneticinle kontrol et." />;
}

export function FeatureUnavailableState({ title = "Bu özellik şu anda kullanılamıyor" }: { title?: string }) {
  return <EmptyState title={title} description="Yapılandırma tamamlandığında bu alanda gerçek durum gösterilecek." />;
}

export function StaleDataState({ lastUpdated }: { lastUpdated?: string | null }) {
  return (
    <div className="state-panel warning" role="status">
      <strong>Toplanmış veri güncel değil</strong>
      <p>{lastUpdated ? `Son toplama: ${lastUpdated}` : "Henüz tamamlanmış bir toplama yok."} Son dönem ham olayları ayrıca gösterilir.</p>
    </div>
  );
}

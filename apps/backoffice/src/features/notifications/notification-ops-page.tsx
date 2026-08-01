"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useState } from "react";

import { authFetch } from "../../lib/auth-client";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";
import { useBackofficeAccess } from "../auth/backoffice-access";
import { EmptyState, LoadingState, RecoverableError } from "../shared/async-state";

type DeliveryItem = {
  kind: string;
  sourceType: string;
  sourceRef: string;
  channel: string;
  status: string;
  provider: string;
  providerStatus: string | null;
  attemptCount: number;
  nextAttemptAt: string | null;
  claimedAt: string | null;
  claimExpiresAt: string | null;
  workerId: string | null;
  lastErrorCode: string | null;
  lastErrorMessageRedacted: string | null;
  skippedReason: string | null;
  createdAt: string;
};

type NotificationOpsPreview = {
  operationalHealth: {
    worker: { status: string; lastHeartbeatAt: string; lastCompletedAt: string | null; lastErrorCode: string | null } | null;
    providers: { email: boolean; push: boolean; n8n: boolean };
    lastSuccessfulDeliveryAt: string | null;
    lastFailedDeliveryAt: string | null;
    retryScheduledCount: number;
    deadLetterCount: number | null;
  };
  channels: Array<{ key: string; label: string; status: "draft_only" | "future"; note: string }>;
  deliveryPolicy: {
    sendEnabled: boolean;
    queueEnabled: boolean;
    emailEnabled: boolean;
    pushEnabled: boolean;
    n8nEnabled: boolean;
  };
  deliveryLogPreview: {
    totals: { all: number; candidate: number; processing: number; blocked: number; sent: number; failed: number; skipped: number };
    recent: DeliveryItem[];
    privacyNote: string;
  };
  transitionPreview: {
    deliveryAllowed: false;
    draftOnly: true;
    allowedDraftOnlyTransitions: Array<{ from: string; to: string; reason: string }>;
    futureSenderTransitions: Array<{ from: string; to: string; blockedUntil: string[] }>;
    privacyNote: string;
  };
  pushReadinessPreview: {
    pushSenderEnabled: boolean;
    providerConfigured: boolean;
    tokenRegistryEnabled: boolean;
    warning: string;
  };
  n8nReadinessPreview: {
    n8nWorkflowEnabled: boolean;
    webhookConfigured: boolean;
    queueEnabled: boolean;
    warning: string;
  };
  warning: string;
};

export function NotificationOpsPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const access = useBackofficeAccess();
  const [data, setData] = useState<NotificationOpsPreview | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void authFetch(apiBaseUrl, "/api/v1/admin/notifications/ops-preview")
      .then(async (response) => ({ response, body: await response.json() as ApiResponse<NotificationOpsPreview> }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok || !body.ok) {
          setData(null);
          setError(true);
          return;
        }
        setData(body.data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [apiBaseUrl, reloadVersion]);

  const recentErrors = data?.deliveryLogPreview.recent.filter((item) => item.lastErrorCode || item.status === "failed") ?? [];
  const supportedChannels = data?.channels.filter((channel) => channel.status !== "future") ?? [];

  return (
    <div className="dashboard-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Bildirim Operasyonları</p>
          <h2>Bildirim gönderim sağlığı</h2>
          <p>İşleyici, kanal ve son teslimat durumlarını hassas alıcı veya ileti içeriği göstermeden izle.</p>
        </div>
      </section>

      {loading ? <LoadingState title="Bildirim operasyon durumu yükleniyor…" /> : null}
      {error ? <RecoverableError title="Bildirim operasyon durumu alınamadı" onRetry={() => setReloadVersion((value) => value + 1)} /> : null}

      {data ? (
        <>
          <section aria-label="Sistem özeti">
            <h3>Sistem özeti</h3>
            <div className="summary-grid dashboard-summary-grid">
              <Metric label="Teslimat bekleyen" value={data.deliveryLogPreview.totals.candidate + data.deliveryLogPreview.totals.processing} />
              <Metric label="Gönderilen" value={data.deliveryLogPreview.totals.sent} />
              <Metric label="Başarısız" value={data.deliveryLogPreview.totals.failed} />
              <Metric label="Engellenen veya atlanan" value={data.deliveryLogPreview.totals.blocked + data.deliveryLogPreview.totals.skipped} />
              <Metric label="Yeniden denenecek" value={data.operationalHealth.retryScheduledCount} />
              <Metric label="Dead-letter" value={data.operationalHealth.deadLetterCount} unavailable="Bu metrik henüz üretilmiyor" />
            </div>
          </section>

          <section className="module-grid" aria-label="İşleyici ve sağlayıcı sağlığı">
            <article className="module-card">
              <h3>İşleyici sağlığı</h3>
              {data.operationalHealth.worker ? (
                <dl className="detail-list">
                  <Detail label="Durum" value={formatEnumLabel(data.operationalHealth.worker.status)} />
                  <Detail label="Son sağlık sinyali" value={formatDateTimeTr(data.operationalHealth.worker.lastHeartbeatAt)} />
                  <Detail label="Son tamamlanma" value={formatDateTimeTr(data.operationalHealth.worker.lastCompletedAt)} />
                  <Detail label="Son hata kodu" value={data.operationalHealth.worker.lastErrorCode ?? "Yok"} />
                </dl>
              ) : <EmptyState title="İşleyici sağlık sinyali henüz yok" description="İlk güvenli işleyici çalışmasından sonra sağlık zamanı burada görünür." />}
            </article>
            <article className="module-card">
              <h3>Sağlayıcı durumu</h3>
              <dl className="detail-list">
                <Detail label="E-posta" value={enabledLabel(data.operationalHealth.providers.email)} />
                <Detail label="Anlık bildirim" value={enabledLabel(data.operationalHealth.providers.push)} />
                <Detail label="n8n" value={enabledLabel(data.operationalHealth.providers.n8n)} />
                <Detail label="Son başarılı teslimat" value={formatDateTimeTr(data.operationalHealth.lastSuccessfulDeliveryAt)} />
                <Detail label="Son başarısız teslimat" value={formatDateTimeTr(data.operationalHealth.lastFailedDeliveryAt)} />
              </dl>
            </article>
          </section>

          <section className="module-card" aria-label="Kanal durumu">
            <h3>Kanal durumu</h3>
            <div className="module-grid">
              {supportedChannels.map((channel) => (
                <article className="module-card" key={channel.key}>
                  <strong>{channel.key === "in_app" ? "Uygulama içi" : channel.key === "email_draft" ? "E-posta taslağı" : channel.label}</strong>
                  <p>{channel.note}</p>
                  <span className="status-badge">{channel.status === "draft_only" ? "Taslak modu" : "Kullanılamıyor"}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="module-card" aria-label="Son teslimat girişimleri">
            <h3>Son teslimat girişimleri</h3>
            <p className="muted">{data.deliveryLogPreview.privacyNote}</p>
            {data.deliveryLogPreview.recent.length === 0 ? (
              <EmptyState title="Henüz teslimat girişimi yok" description="Gerçek bir aday oluştuğunda güvenli operasyon özeti burada görünür." />
            ) : (
              <div className="table-list">
                {data.deliveryLogPreview.recent.map((item) => (
                  <article className="table-list-row" key={`${item.sourceRef}-${item.createdAt}`}>
                    <div>
                      <strong>{formatEnumLabel(item.kind)} · {formatEnumLabel(item.status)}</strong>
                      <p className="muted">{formatEnumLabel(item.channel)} · {formatEnumLabel(item.provider)} · kaynak {item.sourceRef}</p>
                      <p className="muted">{item.attemptCount} deneme · {formatDateTimeTr(item.createdAt)}</p>
                      {item.claimedAt || item.claimExpiresAt || item.workerId ? (
                        <details>
                          <summary>İşleme sahipliği</summary>
                          <dl className="detail-list">
                            <Detail label="Alınma zamanı" value={formatDateTimeTr(item.claimedAt)} />
                            <Detail label="Sahiplik bitişi" value={formatDateTimeTr(item.claimExpiresAt)} />
                            <Detail label="İşleyici kimliği" value={item.workerId ?? "Yok"} />
                          </dl>
                        </details>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="module-card" aria-label="Son hatalar">
            <h3>Son hatalar</h3>
            {recentErrors.length === 0 ? <EmptyState title="Yakın zamanda güvenli hata kaydı yok" /> : (
              <div className="table-list">
                {recentErrors.map((item) => (
                  <div className="table-list-row" key={`${item.sourceRef}-${item.createdAt}-error`}>
                    <div>
                      <strong>{item.lastErrorCode ?? "DELIVERY_FAILED"}</strong>
                      {item.lastErrorMessageRedacted ? <p className="muted">{item.lastErrorMessageRedacted}</p> : null}
                    </div>
                    <span>{formatDateTimeTr(item.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {!access.isReadOnly ? (
            <section className="module-card" aria-label="Güvenli yönetim aksiyonları">
              <h3>Güvenli yönetim aksiyonları</h3>
              <EmptyState title="Bu sürümde güvenli yönetim aksiyonu etkin değil" description="Sunucu bu yeteneği sunmadığı için gönderme, yeniden deneme veya durum geçişi butonu gösterilmiyor." />
            </section>
          ) : null}

          <details className="module-card">
            <summary>Teslimat politikası</summary>
            <p>{data.warning}</p>
            <dl className="detail-list">
              <Detail label="Gerçek teslimat" value={data.transitionPreview.deliveryAllowed ? "Açık" : "Kapalı"} />
              <Detail label="Taslak modu" value={data.transitionPreview.draftOnly ? "Açık" : "Kapalı"} />
              <Detail label="Gönderim" value={enabledLabel(data.deliveryPolicy.sendEnabled)} />
              <Detail label="Kuyruk" value={enabledLabel(data.deliveryPolicy.queueEnabled)} />
              <Detail label="E-posta" value={enabledLabel(data.deliveryPolicy.emailEnabled)} />
              <Detail label="Anlık bildirim" value={enabledLabel(data.deliveryPolicy.pushEnabled)} />
              <Detail label="n8n" value={enabledLabel(data.deliveryPolicy.n8nEnabled)} />
            </dl>
            <p className="muted">Yalnızca toplu sayaçlar, maskeli kaynak referansı ve güvenli hata özeti gösterilir; üst veri, işlem anahtarı, tekilleştirme anahtarı, sağlayıcı sırrı veya ham ileti içeriği gösterilmez.</p>
          </details>

          <details className="module-card">
            <summary>Teslimat geçiş güvenliği</summary>
            <h3>Taslak modunda izin verilen geçişler</h3>
            <p>Bekliyor → Atlandı geçişi gönderim yapmadan kaydı güvenli biçimde kapatır.</p>
            <ul>
              {data.transitionPreview.allowedDraftOnlyTransitions.map((transition) => (
                <li key={`${transition.from}-${transition.to}`}>
                  {formatEnumLabel(transition.from)} → {formatEnumLabel(transition.to)}
                </li>
              ))}
            </ul>
            <h3>Sağlayıcı gerektiren geçişler</h3>
            <p>Gönderildi/Başarısız için sağlayıcı güvenlik katmanları zorunludur.</p>
            <ul>
              {data.transitionPreview.futureSenderTransitions.map((transition) => (
                <li key={`${transition.from}-${transition.to}`}>
                  {formatEnumLabel(transition.from)} → {formatEnumLabel(transition.to)}: {transition.blockedUntil.length} ön koşul
                </li>
              ))}
            </ul>
            <p className="muted">{data.transitionPreview.privacyNote}</p>
          </details>

          <details className="module-card">
            <summary>Anlık bildirim hazırlığı</summary>
            <dl className="detail-list">
              <Detail label="Anlık bildirim göndericisi" value={data.pushReadinessPreview.pushSenderEnabled ? "Açık" : "Kapalı"} />
              <Detail label="Sağlayıcı" value={enabledLabel(data.pushReadinessPreview.providerConfigured)} />
              <Detail label="Cihaz belirteci kaydı" value={enabledLabel(data.pushReadinessPreview.tokenRegistryEnabled)} />
            </dl>
            <p>Anlık bildirim göndericisi kapalı. Expo, Firebase veya APNs çağrısı yapılmıyor.</p>
            <p className="muted">{data.pushReadinessPreview.warning}</p>
          </details>

          <details className="module-card">
            <summary>n8n iş akışı hazırlığı</summary>
            <dl className="detail-list">
              <Detail label="n8n iş akışı" value={data.n8nReadinessPreview.n8nWorkflowEnabled ? "Açık" : "Kapalı"} />
              <Detail label="Webhook" value={enabledLabel(data.n8nReadinessPreview.webhookConfigured)} />
              <Detail label="Kuyruk" value={enabledLabel(data.n8nReadinessPreview.queueEnabled)} />
            </dl>
            <p>Webhook kapalı. Kuyruk ve işleyici kapalı. Gerçek n8n iş akışı tetiklemesi yok.</p>
            <p className="muted">{data.n8nReadinessPreview.warning}</p>
          </details>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, unavailable, value }: { label: string; unavailable?: string; value: number | null }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value === null ? "Ölçülmüyor" : value}</strong>
      {value === null && unavailable ? <small>{unavailable}</small> : null}
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <><dt>{label}</dt><dd>{value}</dd></>;
}

function enabledLabel(value: boolean): string {
  return value ? "Yapılandırıldı" : "Kapalı veya yapılandırılmadı";
}

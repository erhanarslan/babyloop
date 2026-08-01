"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { authFetch } from "../../lib/auth-client";
import { formatDateTimeTr } from "../../lib/presentation";
import { useBackofficeAccess } from "../auth/backoffice-access";
import { LoadingState, RecoverableError } from "../shared/async-state";

type EmailProviderDriver = "mock" | "smtp" | "resend";

type EmailIntent =
  | "email_verification"
  | "password_reset"
  | "notification_digest"
  | "security_alert";

type AdminEmailErrorCategory = "provider_rejected" | "delivery_disabled" | "recipient_not_allowed" | "invalid_recipient" | "rate_limited" | "configuration_missing" | "timeout" | "unknown";

type AdminEmailOpsPreview = {
  emailProvider: {
    driver: EmailProviderDriver;
    sendEnabled: boolean;
    fromConfigured: boolean;
    providerConfigured: boolean;
    sandboxOnly: boolean;
    missingConfigurationCount: number;
    senderDomainVerified: boolean | null;
  };
  recipientPolicyConfigured: boolean;
  supportedIntents: EmailIntent[];
  warning: string;
};

type AdminEmailTestSendResult = {
  intent: EmailIntent;
  status: "accepted" | "not_sent";
  provider: EmailProviderDriver;
  sandboxOnly: boolean;
  deliveryReference: string | null;
  recipientMasked: string;
  occurredAt: string;
  errorCategory: AdminEmailErrorCategory | null;
  message: string;
};

type EmailOpsPageProps = {
  apiBaseUrl: string;
};

const intentLabels: Record<EmailIntent, string> = {
  email_verification: "E-posta doğrulama",
  password_reset: "Şifre sıfırlama",
  notification_digest: "Bildirim özeti",
  security_alert: "Güvenlik uyarısı"
};

const defaultIntent: EmailIntent = "security_alert";
const testSendConfirmation = "SEND_TEST_EMAIL";

export function EmailOpsPage({ apiBaseUrl }: EmailOpsPageProps) {
  const access = useBackofficeAccess();
  const canSend = access.role === "admin" && !access.isReadOnly;
  const [preview, setPreview] = useState<AdminEmailOpsPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [to, setTo] = useState("");
  const [intent, setIntent] = useState<EmailIntent>(defaultIntent);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<AdminEmailTestSendResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const supportedIntents = useMemo(
    () => preview?.supportedIntents ?? [defaultIntent],
    [preview?.supportedIntents]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setIsLoadingPreview(true);
      setPreviewError(null);

      try {
        const response = await authFetch(apiBaseUrl, "/api/v1/admin/email/ops-preview");
        const payload = (await response.json()) as ApiResponse<AdminEmailOpsPreview>;

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.ok) {
          setPreview(null);
          setPreviewError("E-posta operasyon durumu yüklenemedi.");
          return;
        }

        setPreview(payload.data);
        setIntent(payload.data.supportedIntents.includes(defaultIntent) ? defaultIntent : payload.data.supportedIntents[0] ?? defaultIntent);
      } catch {
        if (!cancelled) {
          setPreview(null);
          setPreviewError("E-posta operasyon durumu yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (inFlightRef.current) {
      return;
    }

    const normalizedTo = to.trim();

    if (!normalizedTo) {
      setSendError("Kontrollü test için alıcı adresi gir.");
      return;
    }

    if (!confirmed) {
      setSendError("Kontrollü test gönderimi için onayı işaretle.");
      return;
    }

    const normalizedNote = note.trim();
    const fingerprint = JSON.stringify([normalizedTo.toLowerCase(), intent, normalizedNote]);
    if (idempotencyRef.current?.fingerprint !== fingerprint) {
      idempotencyRef.current = { fingerprint, key: crypto.randomUUID() };
    }

    inFlightRef.current = true;
    setIsSending(true);
    setSendError(null);
    setSendResult(null);

    try {
      const response = await authFetch(apiBaseUrl, "/api/v1/admin/email/test-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: normalizedTo,
          intent,
          confirmation: testSendConfirmation,
          idempotencyKey: idempotencyRef.current.key,
          ...(normalizedNote ? { note: normalizedNote } : {})
        })
      });
      const payload = (await response.json()) as ApiResponse<AdminEmailTestSendResult>;

      if (!response.ok || !payload.ok) {
        setSendError(getSafeSendError(payload));
        return;
      }

      setSendResult(payload.data);
      idempotencyRef.current = null;
    } catch {
      setSendError("Kontrollü test isteği tamamlanamadı. Ağ bağlantısını kontrol edip tekrar dene.");
    } finally {
      inFlightRef.current = false;
      setIsSending(false);
    }
  }

  return (
    <div className="dashboard-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">E-posta Operasyonları</p>
          <h2>E-posta gönderim sağlığı</h2>
          <p>
            Sağlayıcı durumunu, gerçek gönderim anahtarını ve kontrollü test akışını hassas değer
            göstermeden izle. SMTP şifresi, API anahtarı, doğrulama/sıfırlama tokenı, OTP veya
            oturum verisi bu ekranda gösterilmez.
          </p>
        </div>
      </section>

      {isLoadingPreview ? <LoadingState title="E-posta operasyon durumu yükleniyor…" /> : null}
      {previewError ? <RecoverableError title="E-posta operasyon durumu alınamadı" description={previewError} /> : null}

      {preview ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="E-posta sağlayıcı özeti">
            <SummaryCard
              label="Sağlayıcı"
              value={formatDriver(preview.emailProvider.driver)}
              description={getDriverDescription(preview.emailProvider.driver)}
            />
            <SummaryCard
              label="Gerçek gönderim"
              value={preview.emailProvider.sendEnabled ? "Açık" : "Kapalı"}
              description={
                preview.emailProvider.sendEnabled
                  ? "Sağlayıcı gerçek e-posta kabul edecek şekilde açık."
                  : "Gerçek e-posta gönderimi kapalı."
              }
            />
            <SummaryCard
              label="Deneme modu"
              value={preview.emailProvider.sandboxOnly ? "Açık" : "Kapalı"}
              description={
                preview.emailProvider.sandboxOnly
                  ? "Kontrollü test gerçek ileti göndermez."
                  : "Sağlayıcı gerçek gönderime hazır."
              }
            />
            <SummaryCard
              label="Kurulum"
              value={preview.emailProvider.providerConfigured ? "Tamam" : "Eksik"}
              description={
                preview.emailProvider.providerConfigured
                  ? "Sağlayıcı için gerekli yapılandırma tamam."
                  : `${preview.emailProvider.missingConfigurationCount} yapılandırma alanı eksik.`
              }
            />
          </section>

          <section className="module-grid" aria-label="E-posta operasyon ayrıntıları">
            <article className="module-card">
              <div>
                <p className="eyebrow">Sağlayıcı</p>
                <h3>Gönderim konfigürasyonu</h3>
                <p>{preview.warning}</p>
              </div>

              <dl className="detail-list">
                <PolicyItem label="Sağlayıcı" value={formatDriver(preview.emailProvider.driver)} />
                <PolicyItem label="Gerçek gönderim" value={preview.emailProvider.sendEnabled ? "Açık" : "Kapalı"} />
                <PolicyItem label="Deneme modu" value={preview.emailProvider.sandboxOnly ? "Yalnız deneme" : "Gerçek gönderime açık"} />
                <PolicyItem label="Gönderici adresi" value={preview.emailProvider.fromConfigured ? "Tanımlı" : "Eksik"} />
                <PolicyItem label="Gönderici alan adı" value={preview.emailProvider.senderDomainVerified === true ? "Doğrulandı" : preview.emailProvider.senderDomainVerified === false ? "Doğrulanmadı" : "Bu metrik henüz üretilmiyor"} />
                <PolicyItem label="Alıcı politikası" value={preview.recipientPolicyConfigured ? "Tanımlı" : "Eksik"} />
              </dl>

              <div className="info-panel">
                <strong>Operasyon uyarısı</strong>
                <p>{preview.warning}</p>
              </div>
            </article>

            {canSend ? <article className="module-card">
              <div>
                <p className="eyebrow">Kontrollü test</p>
                <h3>Kontrollü test e-postası</h3>
                <p>
                  Test taslağı API üzerinden gönderilir. Gerçek e-posta yalnızca sağlayıcı kurulumu,
                  alıcı politikası ve gerçek gönderim anahtarı hazırsa çıkar.
                </p>
              </div>

              <form className="stacked-form" onSubmit={handleSubmit}>
                <label>
                  <span>Alıcı</span>
                  <input
                    type="email"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    placeholder="admin@example.com"
                    maxLength={320}
                    required
                  />
                </label>

                <label>
                  <span>Senaryo</span>
                  <select value={intent} onChange={(event) => setIntent(event.target.value as EmailIntent)}>
                    {supportedIntents.map((item) => (
                      <option key={item} value={item}>
                        {intentLabels[item]}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Operasyon notu</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="SMTP teslimat doğrulaması"
                    maxLength={240}
                    rows={4}
                  />
                </label>

                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span>
                    <strong>Kontrollü test gönderimini onaylıyorum.</strong>
                    <small>Bu işlem gerçek kullanıcı tokenı, OTP veya hassas değer içermeyen yönetici test e-postası oluşturur.</small>
                  </span>
                </label>

                <button className="primary-action" type="submit" disabled={isSending}>
                  {isSending ? "Gönderiliyor…" : "Test e-postası gönder"}
                </button>
              </form>

              {sendError ? <div className="state-panel danger">{sendError}</div> : null}

              {sendResult ? (
                <div className="info-panel">
                  <strong>Test sonucu</strong>
                  <dl className="detail-list">
                    <PolicyItem label="Senaryo" value={intentLabels[sendResult.intent]} />
                    <PolicyItem label="Sonuç" value={sendResult.status === "accepted" ? "Gönderim kabul edildi" : "Gönderilmedi"} />
                    <PolicyItem label="Sağlayıcı" value={formatDriver(sendResult.provider)} />
                    <PolicyItem label="Deneme modu" value={sendResult.sandboxOnly ? "Açık" : "Kapalı"} />
                    <PolicyItem label="Alıcı" value={sendResult.recipientMasked} />
                    <PolicyItem label="Zaman" value={formatDateTimeTr(sendResult.occurredAt)} />
                    <PolicyItem label="Teslimat referansı" value={sendResult.deliveryReference ?? "Üretilmedi"} />
                    {sendResult.errorCategory ? <PolicyItem label="Hata kategorisi" value={formatErrorCategory(sendResult.errorCategory)} /> : null}
                  </dl>
                  <p>{sendResult.message}</p>
                </div>
              ) : null}
            </article> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function PolicyItem({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function getDriverDescription(driver: EmailProviderDriver): string {
  if (driver === "smtp") {
    return "SMTP sağlayıcısı seçili.";
  }

  if (driver === "resend") {
    return "Resend sağlayıcısı seçili; yapılandırma tamamlandığında gerçek gönderim desteklenir.";
  }

  return "Taklit sağlayıcı seçili.";
}

function formatDriver(driver: EmailProviderDriver): string {
  if (driver === "smtp") {
    return "SMTP";
  }

  if (driver === "resend") {
    return "Resend";
  }

  return "Taklit";
}

function formatErrorCategory(category: AdminEmailErrorCategory): string {
  const labels: Record<AdminEmailErrorCategory, string> = {
    configuration_missing: "Yapılandırma eksik",
    delivery_disabled: "Gönderim kapalı",
    invalid_recipient: "Geçersiz alıcı",
    provider_rejected: "Sağlayıcı reddetti",
    rate_limited: "İstek sınırı aşıldı",
    recipient_not_allowed: "Alıcıya izin verilmiyor",
    timeout: "Zaman aşımı",
    unknown: "Bilinmeyen hata"
  };
  return labels[category];
}

function getSafeSendError(payload: ApiResponse<unknown>): string {
  if (payload.ok) return "Kontrollü test tamamlanamadı.";
  const code = payload.error.code.toLowerCase();
  if (code.includes("recipient_not_allowed")) return "Alıcı kontrollü test listesinde değil.";
  if (code.includes("rate_limited")) return "Kısa sürede çok fazla test istendi. Daha sonra tekrar dene.";
  if (code.includes("configuration_missing")) return "Kontrollü test yapılandırması eksik.";
  if (code.includes("timeout")) return "E-posta sağlayıcısı zamanında yanıt vermedi.";
  if (code.includes("invalid_recipient")) return "Alıcı adresi veya istek bilgileri geçersiz.";
  return "Kontrollü test güvenli biçimde tamamlanamadı.";
}

"use client";

import type { ApiResponse } from "@babyloop/shared";
import { FormEvent, useEffect, useMemo, useState } from "react";

type EmailProviderDriver = "mock" | "smtp" | "resend";

type EmailIntent =
  | "email_verification"
  | "password_reset"
  | "notification_digest"
  | "security_alert";

type EmailSendResult =
  | {
      sent: false;
      provider: EmailProviderDriver;
      sandboxOnly: true;
      reason: "email_delivery_disabled";
    }
  | {
      sent: true;
      provider: "smtp" | "resend";
      sandboxOnly: false;
      messageId: string | null;
    };

type AdminEmailOpsPreview = {
  emailProvider: {
    driver: EmailProviderDriver;
    sendEnabled: boolean;
    fromConfigured: boolean;
    providerConfigured: boolean;
    sandboxOnly: boolean;
    missing: string[];
    warning: string;
  };
  supportedIntents: EmailIntent[];
  warning: string;
};

type AdminEmailTestSendResult = {
  intent: EmailIntent;
  result: EmailSendResult;
  warning: string;
};

type EmailOpsPageProps = {
  apiBaseUrl: string;
};

const intentLabels: Record<EmailIntent, string> = {
  email_verification: "Email doğrulama",
  password_reset: "Şifre sıfırlama",
  notification_digest: "Bildirim özeti",
  security_alert: "Güvenlik uyarısı"
};

const defaultIntent: EmailIntent = "security_alert";
const testSendConfirmation = "SEND_TEST_EMAIL";

export function EmailOpsPage({ apiBaseUrl }: EmailOpsPageProps) {
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
        const response = await fetch(`${apiBaseUrl}/api/v1/admin/email/ops-preview`, {
          credentials: "include"
        });
        const payload = (await response.json()) as ApiResponse<AdminEmailOpsPreview>;

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.ok) {
          setPreview(null);
          setPreviewError("Email ops preview yüklenemedi.");
          return;
        }

        setPreview(payload.data);
        setIntent(payload.data.supportedIntents.includes(defaultIntent) ? defaultIntent : payload.data.supportedIntents[0] ?? defaultIntent);
      } catch {
        if (!cancelled) {
          setPreview(null);
          setPreviewError("Email ops preview yüklenemedi.");
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

    const normalizedTo = to.trim();

    if (!normalizedTo) {
      setSendError("Test email için alıcı adresi gir.");
      return;
    }

    if (!confirmed) {
      setSendError("Kontrollü test gönderimi için onayı işaretle.");
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSendResult(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/email/test-send`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: normalizedTo,
          intent,
          confirmation: testSendConfirmation,
          ...(note.trim() ? { note: note.trim() } : {})
        })
      });
      const payload = (await response.json()) as ApiResponse<AdminEmailTestSendResult>;

      if (!response.ok || !payload.ok) {
        setSendError("Admin test email gönderimi başarısız oldu.");
        return;
      }

      setSendResult(payload.data);
    } catch {
      setSendError("Admin test email gönderimi başarısız oldu.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="dashboard-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Email Operasyonları</p>
          <h2>Email gönderim sağlığı</h2>
          <p>
            Provider durumunu, kill-switch bilgisini ve kontrollü test email akışını secret
            göstermeden izle. SMTP şifresi, API key, doğrulama/sıfırlama tokenı, OTP veya
            session verisi bu ekranda gösterilmez.
          </p>
        </div>
      </section>

      {isLoadingPreview ? <div className="state-panel">Email operasyon durumu yükleniyor...</div> : null}
      {previewError ? <div className="state-panel danger">{previewError}</div> : null}

      {preview ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="Email provider özeti">
            <SummaryCard
              label="Provider"
              value={formatDriver(preview.emailProvider.driver)}
              description={getDriverDescription(preview.emailProvider.driver)}
            />
            <SummaryCard
              label="Gerçek gönderim"
              value={preview.emailProvider.sendEnabled ? "Açık" : "Kapalı"}
              description={
                preview.emailProvider.sendEnabled
                  ? "Provider gerçek email kabul edecek şekilde açık."
                  : "Gerçek email gönderimi kapalı."
              }
            />
            <SummaryCard
              label="Sandbox"
              value={preview.emailProvider.sandboxOnly ? "Açık" : "Kapalı"}
              description={
                preview.emailProvider.sandboxOnly
                  ? "Test-send gerçek mail göndermez."
                  : "Provider gerçek gönderime hazır."
              }
            />
            <SummaryCard
              label="Kurulum"
              value={preview.emailProvider.providerConfigured ? "Tamam" : "Eksik"}
              description={
                preview.emailProvider.providerConfigured
                  ? "Provider için gerekli env alanları tamam."
                  : "Eksik env alanları var."
              }
            />
          </section>

          <section className="module-grid" aria-label="Email operasyon detayları">
            <article className="module-card">
              <div>
                <p className="eyebrow">Provider</p>
                <h3>Gönderim konfigürasyonu</h3>
                <p>{preview.warning}</p>
              </div>

              <dl className="detail-list">
                <PolicyItem label="Provider" value={formatDriver(preview.emailProvider.driver)} />
                <PolicyItem label="Gerçek gönderim" value={preview.emailProvider.sendEnabled ? "Açık" : "Kapalı"} />
                <PolicyItem label="Sandbox modu" value={preview.emailProvider.sandboxOnly ? "Sadece test" : "Gerçek gönderime açık"} />
                <PolicyItem label="From adresi" value={preview.emailProvider.fromConfigured ? "Tanımlı" : "Eksik"} />
                <PolicyItem label="Provider env" value={preview.emailProvider.providerConfigured ? "Tamam" : "Eksik"} />
              </dl>

              <div className="info-panel">
                <strong>Provider uyarısı</strong>
                <p>{preview.emailProvider.warning}</p>
              </div>

              <div className="info-panel">
                <strong>Eksik env alanları</strong>
                {preview.emailProvider.missing.length > 0 ? (
                  <ul className="compact-list">
                    {preview.emailProvider.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Eksik env görünmüyor.</p>
                )}
              </div>
            </article>

            <article className="module-card">
              <div>
                <p className="eyebrow">Smoke test</p>
                <h3>Kontrollü test emaili</h3>
                <p>
                  Test draft’ı backend üzerinden gönderilir. Gerçek email yalnızca provider kurulumu
                  tamam, gönderim kill-switch’i açık ve sandbox modu kapalıysa çıkar.
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
                    placeholder="SMTP smoke testi"
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
                    <small>Bu işlem gerçek kullanıcı tokenı, OTP veya secret içermeyen admin test emaili oluşturur.</small>
                  </span>
                </label>

                <button className="primary-action" type="submit" disabled={isSending}>
                  {isSending ? "Gönderiliyor..." : "Test email gönder"}
                </button>
              </form>

              {sendError ? <div className="state-panel danger">{sendError}</div> : null}

              {sendResult ? (
                <div className="info-panel">
                  <strong>Test sonucu</strong>
                  <dl className="detail-list">
                    <PolicyItem label="Senaryo" value={intentLabels[sendResult.intent]} />
                    <PolicyItem label="Sonuç" value={sendResult.result.sent ? "Provider kabul etti" : "Gerçek mail çıkmadı"} />
                    <PolicyItem label="Provider" value={formatDriver(sendResult.result.provider)} />
                    <PolicyItem label="Sandbox" value={sendResult.result.sandboxOnly ? "Sadece test" : "Kapalı"} />
                    {"reason" in sendResult.result ? (
                      <PolicyItem label="Neden" value={formatSendReason(sendResult.result.reason)} />
                    ) : (
                      <PolicyItem label="Message ID" value={sendResult.result.messageId ?? "Provider kabul etti"} />
                    )}
                  </dl>
                  <p>{sendResult.warning}</p>
                </div>
              ) : null}
            </article>
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
    return "SMTP provider seçili.";
  }

  if (driver === "resend") {
    return "Resend provider seçili; EMAIL_SEND_ENABLED=true ve RESEND_API_KEY hazırsa gerçek gönderim desteklenir.";
  }

  return "Mock provider seçili.";
}

function formatDriver(driver: EmailProviderDriver): string {
  if (driver === "smtp") {
    return "SMTP";
  }

  if (driver === "resend") {
    return "Resend";
  }

  return "Mock";
}

function formatSendReason(reason: "email_delivery_disabled"): string {
  if (reason === "email_delivery_disabled") {
    return "Email gönderimi kapalı";
  }

  return "Gönderim engellendi";
}

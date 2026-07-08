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
  email_verification: "Email verification",
  password_reset: "Password reset",
  notification_digest: "Notification digest",
  security_alert: "Security alert"
};

const defaultIntent: EmailIntent = "security_alert";

export function EmailOpsPage({ apiBaseUrl }: EmailOpsPageProps) {
  const [preview, setPreview] = useState<AdminEmailOpsPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [to, setTo] = useState("");
  const [intent, setIntent] = useState<EmailIntent>(defaultIntent);
  const [note, setNote] = useState("");
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
          <p className="eyebrow">Email Ops</p>
          <h2>Email delivery operasyonları</h2>
          <p>
            Provider durumunu, email kill-switch bilgisini ve kontrollü test email akışını
            secretsız şekilde izle. Bu ekran SMTP şifresi, API key, verification/reset token,
            OTP veya session datası göstermez.
          </p>
        </div>
      </section>

      {isLoadingPreview ? <div className="state-panel">Email ops preview yükleniyor...</div> : null}
      {previewError ? <div className="state-panel state-panel-error">{previewError}</div> : null}

      {preview ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="Email provider summary">
            <SummaryCard
              label="Driver"
              value={preview.emailProvider.driver.toUpperCase()}
              description={getDriverDescription(preview.emailProvider.driver)}
            />
            <SummaryCard
              label="Send enabled"
              value={preview.emailProvider.sendEnabled ? "Açık" : "Kapalı"}
              description={
                preview.emailProvider.sendEnabled
                  ? "Gerçek email provider gönderim modu aktif."
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
              label="Configured"
              value={preview.emailProvider.providerConfigured ? "Evet" : "Hayır"}
              description={
                preview.emailProvider.providerConfigured
                  ? "Provider için gerekli env alanları tamam."
                  : "Eksik env alanları var."
              }
            />
          </section>

          <section className="module-grid" aria-label="Email ops details">
            <article className="module-card">
              <div>
                <p className="eyebrow">Provider</p>
                <h3>Delivery configuration</h3>
                <p>{preview.warning}</p>
              </div>

              <dl className="detail-list">
                <PolicyItem label="Driver" value={preview.emailProvider.driver} />
                <PolicyItem label="Send enabled" value={preview.emailProvider.sendEnabled ? "enabled" : "disabled"} />
                <PolicyItem label="Sandbox only" value={preview.emailProvider.sandboxOnly ? "true" : "false"} />
                <PolicyItem label="From configured" value={preview.emailProvider.fromConfigured ? "true" : "false"} />
                <PolicyItem label="Provider configured" value={preview.emailProvider.providerConfigured ? "true" : "false"} />
              </dl>

              <div className="info-panel">
                <strong>Provider warning</strong>
                <p>{preview.emailProvider.warning}</p>
              </div>

              <div className="info-panel">
                <strong>Missing env</strong>
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
                <h3>Admin test email</h3>
                <p>
                  Kontrollü test email draft’ı gönder. Gerçek mail yalnızca backend tarafında
                  EMAIL_DELIVERY_MODE=provider, EMAIL_PROVIDER=smtp|resend ve EMAIL_SEND_ENABLED=true ise gider.
                </p>
              </div>

              <form className="stacked-form" onSubmit={handleSubmit}>
                <label>
                  <span>To</span>
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
                  <span>Intent</span>
                  <select value={intent} onChange={(event) => setIntent(event.target.value as EmailIntent)}>
                    {supportedIntents.map((item) => (
                      <option key={item} value={item}>
                        {intentLabels[item]}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Note</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="SMTP smoke test"
                    maxLength={240}
                    rows={4}
                  />
                </label>

                <button className="primary-action" type="submit" disabled={isSending}>
                  {isSending ? "Gönderiliyor..." : "Test email gönder"}
                </button>
              </form>

              {sendError ? <div className="state-panel state-panel-error">{sendError}</div> : null}

              {sendResult ? (
                <div className="info-panel">
                  <strong>Test result</strong>
                  <dl className="detail-list">
                    <PolicyItem label="Intent" value={sendResult.intent} />
                    <PolicyItem label="Sent" value={sendResult.result.sent ? "true" : "false"} />
                    <PolicyItem label="Provider" value={sendResult.result.provider} />
                    <PolicyItem label="Sandbox only" value={sendResult.result.sandboxOnly ? "true" : "false"} />
                    {"reason" in sendResult.result ? (
                      <PolicyItem label="Reason" value={sendResult.result.reason} />
                    ) : (
                      <PolicyItem label="Message ID" value={sendResult.result.messageId ?? "accepted"} />
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

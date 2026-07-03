"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, LoadingBlock, TextInput } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  disableMfa,
  enableMfa,
  fetchMfaStatus,
  type MfaStatusPayload
} from "./api";

type MfaSettingsPanelProps = {
  apiBaseUrl: string;
};

type PanelStatus = "loading" | "ready" | "error";

export function MfaSettingsPanel({ apiBaseUrl }: MfaSettingsPanelProps) {
  const { dictionary } = useI18n();
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [mfaStatus, setMfaStatus] = useState<MfaStatusPayload | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const clearProtectedState = useCallback(() => {
    setStatus("ready");
    setMfaStatus(null);
    setCurrentPassword("");
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
  }, []);

  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  const loadMfaStatus = useCallback(async () => {
    if (!(await requireAuth())) {
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const body = await fetchMfaStatus(apiBaseUrl);

      if (!body.ok) {
        setStatus("error");
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setMfaStatus(body.data);
      setStatus("ready");
    } catch {
      setStatus("error");
      setErrorMessage(dictionary.common.apiUnavailable);
    }
  }, [apiBaseUrl, dictionary, requireAuth]);

  useEffect(() => {
    void loadMfaStatus();
  }, [loadMfaStatus]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!(await requireAuth())) {
      return;
    }

    const trimmedCurrentPassword = currentPassword.trim();

    if (!trimmedCurrentPassword) {
      setSuccessMessage(null);
      setErrorMessage(dictionary.auth.currentPasswordRequired);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const nextEnabled = !mfaStatus?.mfaEnabled;
      const body = nextEnabled
        ? await enableMfa(apiBaseUrl, trimmedCurrentPassword)
        : await disableMfa(apiBaseUrl, trimmedCurrentPassword);

      if (!body.ok) {
        setErrorMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setMfaStatus({
        delivery: body.data.delivery,
        method: body.data.method,
        mfaEnabled: body.data.mfaEnabled
      });
      setCurrentPassword("");
      setSuccessMessage(
        body.data.mfaEnabled
          ? "OTP / MFA etkinleştirildi. Sonraki girişlerde e-posta OTP kodu istenecek."
          : "OTP / MFA kapatıldı. Sonraki girişlerde ikinci doğrulama istenmeyecek."
      );
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingAuth || status === "loading") {
    return <LoadingBlock title="OTP / MFA durumu yükleniyor" />;
  }

  const enabled = Boolean(mfaStatus?.mfaEnabled);

  return (
    <form className="listing-form auth-recovery-form" onSubmit={handleSubmit}>
      <div className="auth-form-intro">
        <p className="eyebrow">OTP / MFA</p>
        <h2>E-posta OTP doğrulaması</h2>
        <p>
          Hesabına girişte şifreye ek olarak e-posta ile gönderilen 6 haneli OTP kodu istenir.
          Bu ayar gerçek API üzerinden yönetilir.
        </p>
      </div>

      <div className="auth-security-summary" aria-label="MFA durum özeti">
        <div>
          <strong>{enabled ? "Aktif" : "Kapalı"}</strong>
          <span>
            {enabled
              ? "Sonraki girişlerde e-posta OTP kodu gerekir."
              : "İkinci doğrulama şu an kapalı."}
          </span>
        </div>
        <div>
          <strong>E-posta OTP</strong>
          <span>Kod gönderimi login sırasında başlatılır; kodlar 6 hanelidir ve kısa süreli geçerlidir.</span>
        </div>
      </div>

      <TextInput
        label={dictionary.auth.currentPassword}
        name="currentPassword"
        type="password"
        maxLength={128}
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        wide
      />

      {errorMessage ? <Alert title="OTP / MFA güncellenemedi" message={errorMessage} /> : null}

      {successMessage ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm font-bold text-primary" role="status">
          {successMessage}
        </div>
      ) : null}

      <div className="form-actions auth-form-actions">
        <p className="form-note">
          Güvenlik için bu işlemde mevcut şifren tekrar doğrulanır. Şifren veya OTP kodun kullanıcıya açık
          alanlarda gösterilmez.
        </p>
        <Button type="submit" disabled={isSubmitting || status === "error"}>
          {isSubmitting
            ? "Güncelleniyor..."
            : enabled
              ? "OTP / MFA kapat"
              : "OTP / MFA etkinleştir"}
        </Button>
      </div>

      {status === "error" ? (
        <Button type="button" variant="secondary" onClick={() => void loadMfaStatus()}>
          Tekrar dene
        </Button>
      ) : null}
    </form>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  disableMfa,
  enableMfa,
  fetchMfaStatus,
  type MfaStatusPayload
} from "./api";
import { CurrentPasswordConfirmationModal } from "./current-password-confirmation-modal";

type MfaSettingsPanelProps = {
  apiBaseUrl: string;
};

export function MfaSettingsPanel({ apiBaseUrl }: MfaSettingsPanelProps) {
  const { dictionary } = useI18n();
  const [mfaStatus, setMfaStatus] = useState<MfaStatusPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({ apiBaseUrl });

  const loadMfaStatus = useCallback(async () => {
    if (!(await requireAuth())) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetchMfaStatus(apiBaseUrl);

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error, dictionary));
        return;
      }

      setMfaStatus(response.data);
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, dictionary, requireAuth]);

  useEffect(() => {
    void loadMfaStatus();
  }, [loadMfaStatus]);

  const enabled = Boolean(mfaStatus?.mfaEnabled);

  async function handleConfirm(currentPassword: string) {
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = enabled
        ? await disableMfa(apiBaseUrl, currentPassword)
        : await enableMfa(apiBaseUrl, currentPassword);

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error, dictionary));
        return;
      }

      setMfaStatus(response.data);
      setIsModalOpen(false);
      setStatusMessage(
        response.data.mfaEnabled
          ? "İki adımlı doğrulama açıldı."
          : "İki adımlı doğrulama kapatıldı."
      );
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5" aria-label="İki adımlı doğrulama">
      <div className="flex items-center justify-between gap-5">
        <div>
          <h3 className="text-base font-black text-foreground">İki adımlı doğrulama</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
            Giriş yaparken e-postana gönderilen tek kullanımlık kodu iste.
          </p>
        </div>
        <button
          aria-checked={enabled}
          aria-label={`İki adımlı doğrulama ${enabled ? "açık" : "kapalı"}`}
          className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            enabled ? "bg-primary" : "bg-muted-foreground/35"
          }`}
          disabled={isCheckingAuth || isLoading}
          role="switch"
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setIsModalOpen(true);
          }}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
              enabled ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      {statusMessage ? (
        <p className="mt-3 text-sm font-bold text-primary" role="status">{statusMessage}</p>
      ) : null}

      {!isModalOpen && errorMessage ? (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm font-bold text-destructive" role="alert">
          <span>{errorMessage}</span>
          <button className="underline" type="button" onClick={() => void loadMfaStatus()}>
            Tekrar dene
          </button>
        </div>
      ) : null}

      <CurrentPasswordConfirmationModal
        description={`İki adımlı doğrulamayı ${enabled ? "kapatmak" : "açmak"} için şifreni doğrula.`}
        errorMessage={errorMessage}
        isOpen={isModalOpen}
        isSubmitting={isSubmitting}
        submitLabel={enabled ? "Kapat" : "Aç"}
        title="Mevcut şifreni gir"
        onClose={() => {
          if (!isSubmitting) {
            setIsModalOpen(false);
            setErrorMessage(null);
          }
        }}
        onConfirm={(password) => void handleConfirm(password)}
      />
    </section>
  );
}

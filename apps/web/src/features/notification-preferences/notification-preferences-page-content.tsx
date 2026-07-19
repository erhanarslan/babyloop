"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, LoadingBlock, PageContainer } from "../../components/ui";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  fetchNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferencesPayload
} from "./api";
import {
  findMarketplaceEmailPreference,
  marketplaceEmailPreferenceDefinitions,
  replaceNotificationPreference,
  type MarketplaceEmailPreferenceSource
} from "./marketplace-email-preferences-model";

type NotificationPreferencesPageContentProps = {
  apiBaseUrl: string;
};

export function NotificationPreferencesPageContent({
  apiBaseUrl
}: NotificationPreferencesPageContentProps) {
  const { dictionary } = useI18n();
  const { isCheckingAuth, requireAuth } = useProtectedRoute({ apiBaseUrl });
  const [payload, setPayload] = useState<NotificationPreferencesPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [updatingSource, setUpdatingSource] = useState<MarketplaceEmailPreferenceSource | null>(null);

  const loadPreferences = useCallback(async () => {
    if (!(await requireAuth())) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetchNotificationPreferences(apiBaseUrl);

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error as ApiError, dictionary));
        setPayload(null);
        return;
      }

      setPayload(response.data);
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
      setPayload(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, dictionary, requireAuth]);

  useEffect(() => {
    if (!isCheckingAuth) {
      void loadPreferences();
    }
  }, [isCheckingAuth, loadPreferences]);

  async function updateEmailPreference(
    source: MarketplaceEmailPreferenceSource,
    enabled: boolean
  ) {
    if (!payload || updatingSource) {
      return;
    }

    const currentPreference = findMarketplaceEmailPreference(payload.preferences, source);
    setUpdatingSource(source);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await updateNotificationPreference(apiBaseUrl, {
        source,
        channel: "email",
        enabled,
        mutedUntil: currentPreference?.mutedUntil ?? null,
        quietHoursStart: currentPreference?.quietHoursStart ?? null,
        quietHoursEnd: currentPreference?.quietHoursEnd ?? null,
        timezone: currentPreference?.timezone ?? "Europe/Istanbul",
        digest: currentPreference?.digest ?? "immediate"
      });

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error as ApiError, dictionary));
        return;
      }

      setPayload((current) => current ? {
        ...current,
        preferences: replaceNotificationPreference(current.preferences, response.data.preference),
        summary: response.data.summary
      } : current);
      setStatusMessage(enabled ? "E-posta bildirimi açıldı." : "E-posta bildirimi kapatıldı.");
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setUpdatingSource(null);
    }
  }

  return (
    <PageContainer
      ariaLabel="Bildirim ayarları"
      className="max-w-3xl pb-16 pt-6 sm:pt-8"
    >
      <header className="mb-5">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Bildirim ayarları
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground sm:text-base">
          Sana hangi durumlarda e-posta göndereceğimizi seç.
        </p>
      </header>

      {errorMessage ? (
        <div className="mb-4">
          <Alert title="Bildirim ayarları güncellenemedi" message={errorMessage} />
        </div>
      ) : null}

      {isLoading || isCheckingAuth ? (
        <LoadingBlock title="Bildirim ayarları yükleniyor" />
      ) : payload ? (
        <section className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/90 shadow-[0_18px_60px_rgba(55,48,42,0.08)]">
          <div className="border-b border-border/70 p-5 sm:p-6">
            <h2 className="text-xl font-black text-foreground">E-posta bildirimleri</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
              Tercihlerini istediğin zaman değiştirebilirsin.
            </p>
          </div>

          <div className="divide-y divide-border/70">
            {marketplaceEmailPreferenceDefinitions.map((definition) => {
              const preference = findMarketplaceEmailPreference(payload.preferences, definition.source);
              const enabled = preference?.enabled ?? false;
              const isUpdating = updatingSource === definition.source;

              return (
                <div
                  className="flex items-center justify-between gap-5 p-5 sm:p-6"
                  key={definition.source}
                >
                  <div>
                    <h3 className="text-base font-black text-foreground">{definition.title}</h3>
                    <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                      {definition.description}
                    </p>
                  </div>

                  <button
                    aria-checked={enabled}
                    aria-label={`${definition.title} ${enabled ? "açık" : "kapalı"}`}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      enabled ? "bg-primary" : "bg-muted-foreground/35"
                    }`}
                    disabled={updatingSource !== null}
                    role="switch"
                    type="button"
                    onClick={() => void updateEmailPreference(definition.source, !enabled)}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        enabled ? "left-6" : "left-1"
                      } ${isUpdating ? "opacity-60" : ""}`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {statusMessage ? (
            <p aria-live="polite" className="border-t border-border/70 px-5 py-4 text-sm font-bold text-primary sm:px-6">
              {statusMessage}
            </p>
          ) : null}
        </section>
      ) : null}
    </PageContainer>
  );
}

"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useState } from "react";

import {
  getMarketplacePublicationSettings,
  updateMarketplacePublicationSettings,
  type MarketplacePublicationSettings,
} from "./api";

const DEFAULT_DELAY_SECONDS = 30;

export function ListingPublicationSettingsCard() {
  const [settings, setSettings] = useState<MarketplacePublicationSettings | null>(null);
  const [adminReviewEnabled, setAdminReviewEnabled] = useState(false);
  const [autoPublishDelaySeconds, setAutoPublishDelaySeconds] = useState(DEFAULT_DELAY_SECONDS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getMarketplacePublicationSettings();

      if (!active) {
        return;
      }

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response, "Yayın politikası yüklenemedi."));
        setIsLoading(false);
        return;
      }

      const nextSettings = response.data.settings;
      setSettings(nextSettings);
      setAdminReviewEnabled(nextSettings.adminReviewEnabled);
      setAutoPublishDelaySeconds(nextSettings.autoPublishDelaySeconds);
      setIsLoading(false);
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const hasValidDelay =
    Number.isInteger(autoPublishDelaySeconds) &&
    autoPublishDelaySeconds >= 5 &&
    autoPublishDelaySeconds <= 86400;
  const hasChanges =
    settings !== null &&
    hasValidDelay &&
    (settings.adminReviewEnabled !== adminReviewEnabled ||
      settings.autoPublishDelaySeconds !== autoPublishDelaySeconds);

  async function saveSettings() {
    if (!hasChanges || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await updateMarketplacePublicationSettings({
      adminReviewEnabled,
      autoPublishDelaySeconds,
    });

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response, "Yayın politikası güncellenemedi."));
      setIsSaving(false);
      return;
    }

    setSettings(response.data.settings);
    setAdminReviewEnabled(response.data.settings.adminReviewEnabled);
    setAutoPublishDelaySeconds(response.data.settings.autoPublishDelaySeconds);
    setSuccessMessage("Yayın politikası kaydedildi ve bekleyen ilanlara uygulandı.");
    setIsSaving(false);
  }

  return (
    <section className="publication-settings-card" data-admin-publication-settings>
      <div className="publication-settings-card__header">
        <div>
          <p className="eyebrow">Yayın politikası</p>
          <h3>İlan onay akışı</h3>
          <p>
            AI görsel kontrolü her zaman çalışır. Manuel inceleme açıkken ilanı bir yönetici
            yayınlar; kapalıyken güvenli ilanlar gecikme sonunda otomatik yayınlanır.
          </p>
        </div>
        <span className={`status-badge ${adminReviewEnabled ? "in_review" : "approved"}`}>
          {adminReviewEnabled ? "Admin onayı açık" : "Otomatik yayın açık"}
        </span>
      </div>

      {isLoading ? <div className="state-panel">Yayın politikası yükleniyor...</div> : null}

      {!isLoading ? (
        <div className="publication-settings-card__controls">
          <label className="publication-toggle-row">
            <span>
              <strong>Admin incelemesi</strong>
              <small>
                Açıldığında AI kontrolünü geçen ilanlar yayınlanmadan önce inceleme kuyruğunda bekler.
              </small>
            </span>
            <input
              checked={adminReviewEnabled}
              onChange={(event) => {
                setAdminReviewEnabled(event.target.checked);
                setSuccessMessage(null);
              }}
              role="switch"
              type="checkbox"
            />
          </label>

          <label className="form-field publication-delay-field">
            <span>Otomatik yayın gecikmesi</span>
            <div className="publication-delay-input">
              <input
                disabled={adminReviewEnabled}
                max={86400}
                min={5}
                onChange={(event) => {
                  setAutoPublishDelaySeconds(Number(event.target.value));
                  setSuccessMessage(null);
                }}
                type="number"
                value={autoPublishDelaySeconds}
              />
              <span>saniye</span>
            </div>
            <small>Demo varsayılanı 30 saniyedir. Bu süre kullanıcıya gösterilmez.</small>
          </label>

          <div className="form-button-row">
            <button
              className="primary-action"
              disabled={!hasChanges || isSaving}
              onClick={() => {
                void saveSettings();
              }}
              type="button"
            >
              {isSaving ? "Kaydediliyor..." : "Politikayı kaydet"}
            </button>
          </div>
        </div>
      ) : null}

      {!isLoading && !hasValidDelay ? (
        <div className="state-panel danger" role="alert">
          Otomatik yayın gecikmesi 5 ile 86400 saniye arasında tam sayı olmalı.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? <p className="form-success">{successMessage}</p> : null}
    </section>
  );
}

function getApiErrorMessage(response: ApiResponse<unknown>, fallback: string): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.message ?? fallback;
}

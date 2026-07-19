"use client";

import { useState } from "react";
import { Button } from "../../components/ui";
import type { BrowseListingsFilters } from "../../lib/api";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { createSavedSearch } from "./api";

type SaveSearchButtonProps = {
  apiBaseUrl: string;
  categoryName?: string | undefined;
  filters: BrowseListingsFilters;
};

export function SaveSearchButton({
  apiBaseUrl,
  categoryName,
  filters
}: SaveSearchButtonProps) {
  const { dictionary } = useI18n();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const summary = buildSavedSearchSummary(filters, categoryName);

  async function handleSaveSearch() {
    setIsSaving(true);
    setMessage(null);

    const token = await getOrRefreshAuthToken(apiBaseUrl);

    if (!token) {
      setMessage({ tone: "error", text: "Aramayı kaydetmek için giriş yap." });
      setIsSaving(false);
      return;
    }

    const response = await createSavedSearch(apiBaseUrl, {
      name: buildSavedSearchName(filters, categoryName),
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.listingType ? { listingType: filters.listingType } : {}),
      ...(filters.condition ? { condition: filters.condition } : {}),
      ...(filters.priceMin ? { priceMin: filters.priceMin } : {}),
      ...(filters.priceMax ? { priceMax: filters.priceMax } : {}),
      hasImages: filters.hasImages === "true",
      sort: filters.sort,
      notificationsEnabled: false
    });

    setIsSaving(false);

    if (!response.ok) {
      setMessage({ tone: "error", text: getApiErrorMessage(response.error as ApiError, dictionary) });
      return;
    }

    setMessage({ tone: "success", text: "Arama kaydedildi. Hesabından tekrar açabilirsin." });
  }

  return (
    <div className="save-search-panel">
      <div>
        <p className="eyebrow">Aramayı kaydet</p>
        <p className="save-search-summary">{summary}</p>
        <p className="form-note">Bildirimler varsayılan olarak kapalı kalır; sadece filtrelerin kaydedilir.</p>
      </div>
      <Button disabled={isSaving} onClick={() => void handleSaveSearch()} type="button" variant="secondary">
        {isSaving ? "Kaydediliyor..." : "Bu aramayı kaydet"}
      </Button>
      {message ? (
        <p className={`form-note ${message.tone === "success" ? "text-success" : "text-warning"}`} aria-live="polite">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

function buildSavedSearchName(filters: BrowseListingsFilters, categoryName?: string): string {
  if (filters.q.trim().length > 0) {
    return `Arama: ${filters.q.trim()}`.slice(0, 120);
  }

  if (categoryName) {
    return `Kategori: ${categoryName}`.slice(0, 120);
  }

  return "BabyLoop araması";
}

function buildSavedSearchSummary(filters: BrowseListingsFilters, categoryName?: string): string {
  const parts = [
    filters.q.trim() ? `Arama: ${filters.q.trim()}` : "",
    filters.city.trim() ? `Konum: ${filters.city.trim()}` : "",
    categoryName ? `Kategori: ${categoryName}` : "",
    filters.listingType ? `Tip: ${filters.listingType}` : "",
    filters.condition ? `Durum: ${filters.condition}` : "",
    filters.priceMin ? `En az: ${filters.priceMin}` : "",
    filters.priceMax ? `En çok: ${filters.priceMax}` : "",
    filters.hasImages === "true" ? "Sadece görselli" : "",
    filters.sort && filters.sort !== "newest" ? `Sıralama: ${filters.sort}` : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Tüm aktif ilanlar";
}

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
      setMessage({ tone: "error", text: "Sign in to save this search." });
      setIsSaving(false);
      return;
    }

    const response = await createSavedSearch(apiBaseUrl, {
      name: buildSavedSearchName(filters, categoryName),
      ...(filters.q ? { q: filters.q } : {}),
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

    setMessage({ tone: "success", text: "Search saved. You can reuse it from your account." });
  }

  return (
    <div className="save-search-panel">
      <div>
        <p className="eyebrow">Saved search</p>
        <p className="save-search-summary">{summary}</p>
        <p className="form-note">Notifications stay off by default; this only stores your filter set.</p>
      </div>
      <Button disabled={isSaving} onClick={() => void handleSaveSearch()} type="button" variant="secondary">
        {isSaving ? "Saving search..." : "Save this search"}
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
    return `Search: ${filters.q.trim()}`.slice(0, 120);
  }

  if (categoryName) {
    return `Category: ${categoryName}`.slice(0, 120);
  }

  return "Saved BabyLoop search";
}

function buildSavedSearchSummary(filters: BrowseListingsFilters, categoryName?: string): string {
  const parts = [
    filters.q.trim() ? `Search: ${filters.q.trim()}` : "",
    categoryName ? `Category: ${categoryName}` : "",
    filters.listingType ? `Type: ${filters.listingType}` : "",
    filters.condition ? `Condition: ${filters.condition}` : "",
    filters.priceMin ? `Min: ${filters.priceMin}` : "",
    filters.priceMax ? `Max: ${filters.priceMax}` : "",
    filters.hasImages === "true" ? "Images only" : "",
    filters.sort && filters.sort !== "newest" ? `Sort: ${filters.sort}` : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "All active marketplace listings";
}

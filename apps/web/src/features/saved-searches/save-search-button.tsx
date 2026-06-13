"use client";

import { useState } from "react";
import type { BrowseListingsFilters } from "../../lib/api";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { Button } from "../../components/ui";
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
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveSearch() {
    setIsSaving(true);
    setMessage(null);

    const token = await getOrRefreshAuthToken(apiBaseUrl);

    if (!token) {
      setMessage("Sign in to save this search.");
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
      setMessage(getApiErrorMessage(response.error as ApiError, dictionary));
      return;
    }

    setMessage("Search saved.");
  }

  return (
    <div className="save-search-panel">
      <Button disabled={isSaving} onClick={() => void handleSaveSearch()} type="button" variant="secondary">
        {isSaving ? "Saving search..." : "Save this search"}
      </Button>
      {message ? <p className="form-note">{message}</p> : null}
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

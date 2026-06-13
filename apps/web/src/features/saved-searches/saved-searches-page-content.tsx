"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageContainer,
  PageHeading
} from "../../components/ui";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  deleteSavedSearch,
  fetchSavedSearches,
  type SavedSearch
} from "./api";

type SavedSearchesPageContentProps = {
  apiBaseUrl: string;
};

export function SavedSearchesPageContent({ apiBaseUrl }: SavedSearchesPageContentProps) {
  const { dictionary } = useI18n();
  const { isCheckingAuth } = useProtectedRoute({ apiBaseUrl });
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSavedSearches = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const response = await fetchSavedSearches(apiBaseUrl);

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response.error as ApiError, dictionary));
      setIsLoading(false);
      return;
    }

    setSavedSearches(response.data.savedSearches);
    setIsLoading(false);
  }, [apiBaseUrl, dictionary]);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    void loadSavedSearches();
  }, [isCheckingAuth, loadSavedSearches]);

  async function handleDelete(savedSearch: SavedSearch) {
    const response = await deleteSavedSearch(apiBaseUrl, savedSearch.id);

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response.error as ApiError, dictionary));
      return;
    }

    await loadSavedSearches();
  }

  return (
    <>
      <PageHeading
        eyebrow="Saved searches"
        title="Saved marketplace searches"
        description="Keep useful filter sets for later. Notification delivery is intentionally off by default."
      />

      <PageContainer className="listing-column" ariaLabel="Saved searches">
        {errorMessage ? (
          <Alert title="Saved search action failed" message={errorMessage} />
        ) : null}

        {isLoading || isCheckingAuth ? (
          <LoadingBlock title="Loading saved searches" message="Checking your saved marketplace filters." />
        ) : null}

        {!isLoading && savedSearches.length === 0 ? (
          <EmptyState
            title="No saved searches yet"
            message="Save a search from the browse page to reuse filters later."
            actionHref="/browse"
            actionLabel="Browse listings"
          />
        ) : null}

        {savedSearches.map((savedSearch) => (
          <Card as="article" className="form-panel" key={savedSearch.id}>
            <div className="form-actions">
              <div>
                <h2>{savedSearch.name}</h2>
                <div className="filter-chip-list saved-search-chip-list" aria-label="Saved search filters">
                  {buildSavedSearchChips(savedSearch).map((chip) => (
                    <span className="filter-chip" key={chip}>{chip}</span>
                  ))}
                </div>
                <p className="form-note">{buildSavedSearchSummary(savedSearch)}</p>
              </div>
              <div className="form-actions">
                <Link href={buildSavedSearchHref(savedSearch)}>Open</Link>
                <Button type="button" variant="secondary" onClick={() => void handleDelete(savedSearch)}>
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </PageContainer>
    </>
  );
}

function buildSavedSearchHref(savedSearch: SavedSearch): string {
  const params = new URLSearchParams();

  appendParam(params, "q", savedSearch.q);
  appendParam(params, "categoryId", savedSearch.categoryId ?? "");
  appendParam(params, "listingType", savedSearch.listingType ?? "");
  appendParam(params, "condition", savedSearch.condition ?? "");
  appendParam(params, "priceMin", savedSearch.priceMin ?? "");
  appendParam(params, "priceMax", savedSearch.priceMax ?? "");
  appendParam(params, "hasImages", savedSearch.hasImages ? "true" : "");
  appendParam(params, "sort", savedSearch.sort);

  const query = params.toString();

  return query ? `/browse?${query}` : "/browse";
}

function buildSavedSearchSummary(savedSearch: SavedSearch): string {
  const parts = buildSavedSearchChips(savedSearch);

  return parts.length > 0 ? parts.join(" · ") : "No filters";
}

function buildSavedSearchChips(savedSearch: SavedSearch): string[] {
  return [
    savedSearch.q ? `Search: ${savedSearch.q}` : "",
    savedSearch.listingType ? `Type: ${savedSearch.listingType}` : "",
    savedSearch.condition ? `Condition: ${savedSearch.condition}` : "",
    savedSearch.priceMin ? `Min: ${savedSearch.priceMin}` : "",
    savedSearch.priceMax ? `Max: ${savedSearch.priceMax}` : "",
    savedSearch.hasImages ? "Images only" : "",
    savedSearch.sort && savedSearch.sort !== "newest" ? `Sort: ${savedSearch.sort}` : ""
  ].filter(Boolean);
}

function appendParam(params: URLSearchParams, key: string, value: string): void {
  if (value.trim().length > 0) {
    params.set(key, value.trim());
  }
}

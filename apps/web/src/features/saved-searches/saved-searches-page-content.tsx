"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  EmptyState,
  LoadingBlock,
  PageContainer
} from "../../components/ui";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  deleteSavedSearch,
  fetchSavedSearches,
  updateSavedSearchNotifications,
  type SavedSearch
} from "./api";

type SavedSearchesPageContentProps = {
  apiBaseUrl: string;
};

type SavedSearchFilter = "all" | "notifications_on" | "notifications_off";

const FILTERS: SavedSearchFilter[] = ["all", "notifications_on", "notifications_off"];

export function SavedSearchesPageContent({ apiBaseUrl }: SavedSearchesPageContentProps) {
  const { dictionary } = useI18n();
  const { isCheckingAuth, requireAuth } = useProtectedRoute({ apiBaseUrl });
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSavedSearchId, setPendingSavedSearchId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<SavedSearchFilter>("all");
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

  const metrics = useMemo(() => buildSavedSearchMetrics(savedSearches), [savedSearches]);
  const sortedSavedSearches = useMemo(
    () => sortSavedSearches(savedSearches.filter((savedSearch) => matchesFilter(savedSearch, activeFilter))),
    [activeFilter, savedSearches]
  );

  async function handleToggleNotifications(savedSearch: SavedSearch) {
    if (!(await requireAuth())) {
      return;
    }

    setPendingSavedSearchId(savedSearch.id);
    setErrorMessage(null);

    const response = await updateSavedSearchNotifications(
      apiBaseUrl,
      savedSearch.id,
      !savedSearch.notificationsEnabled
    );

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response.error as ApiError, dictionary));
      setPendingSavedSearchId(null);
      return;
    }

    setSavedSearches((currentSearches) =>
      currentSearches.map((currentSearch) =>
        currentSearch.id === savedSearch.id ? response.data.savedSearch : currentSearch
      )
    );
    setPendingSavedSearchId(null);
  }

  async function handleDelete(savedSearch: SavedSearch) {
    if (!(await requireAuth())) {
      return;
    }

    setPendingSavedSearchId(savedSearch.id);
    setErrorMessage(null);

    const response = await deleteSavedSearch(apiBaseUrl, savedSearch.id);

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response.error as ApiError, dictionary));
      setPendingSavedSearchId(null);
      return;
    }

    setSavedSearches((currentSearches) =>
      currentSearches.filter((currentSearch) => currentSearch.id !== savedSearch.id)
    );
    setPendingSavedSearchId(null);
  }

  return (
    <PageContainer className="pb-12 pt-5" ariaLabel={dictionary.savedSearches.ariaLabel}>
      <section className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="self-start rounded-[1.25rem] border border-border/70 bg-muted/25 p-3">
          <nav aria-label={dictionary.savedSearches.filtersLabel} className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
            {FILTERS.map((filter) => (
              <button
                aria-pressed={activeFilter === filter}
                className={[
                  "min-w-[170px] rounded-2xl border px-3 py-2 text-left text-sm font-black transition lg:min-w-0",
                  activeFilter === filter
                    ? "border-primary/40 bg-background text-primary shadow-sm"
                    : "border-transparent text-foreground hover:bg-background/75"
                ].join(" ")}
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
              >
                <span>{getFilterLabel(dictionary, filter)}</span>
                <small className="mt-1 block text-xs font-bold text-muted-foreground">
                  {getFilterCount(metrics, filter)}
                </small>
              </button>
            ))}
          </nav>
        </aside>

        <div className="grid min-w-0 gap-4">
          <div className="rounded-[1.25rem] border border-border/70 bg-background p-4">
            <h1 className="text-2xl font-black tracking-tight text-foreground">{dictionary.savedSearches.title}</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {dictionary.savedSearches.description}
            </p>
          </div>

          {errorMessage ? <Alert title={dictionary.savedSearches.actionFailedTitle} message={errorMessage} /> : null}

          {isLoading || isCheckingAuth ? (
            <LoadingBlock title={dictionary.savedSearches.loadingTitle} message={dictionary.savedSearches.loadingMessage} />
          ) : null}

          {!isLoading && savedSearches.length === 0 ? (
            <EmptyState
              title={dictionary.savedSearches.emptyTitle}
              message={dictionary.savedSearches.emptyMessage}
              actionHref="/browse"
              actionLabel={dictionary.savedSearches.browseAction}
            />
          ) : null}

          {!isLoading && savedSearches.length > 0 && sortedSavedSearches.length === 0 ? (
            <EmptyState
              title={dictionary.savedSearches.emptyFilterTitle}
              message={dictionary.savedSearches.emptyFilterMessage}
              actionHref="/browse"
              actionLabel={dictionary.savedSearches.browseAction}
            />
          ) : null}

          {!isLoading && sortedSavedSearches.length > 0 ? (
            <div className="grid gap-3">
              {sortedSavedSearches.map((savedSearch) => (
                <SavedSearchCard
                  dictionary={dictionary}
                  isPending={pendingSavedSearchId === savedSearch.id}
                  key={savedSearch.id}
                  savedSearch={savedSearch}
                  onDelete={() => void handleDelete(savedSearch)}
                  onToggleNotifications={() => void handleToggleNotifications(savedSearch)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </PageContainer>
  );
}

function SavedSearchCard({
  dictionary,
  isPending,
  onDelete,
  onToggleNotifications,
  savedSearch
}: {
  dictionary: Dictionary;
  isPending: boolean;
  onDelete: () => void;
  onToggleNotifications: () => void;
  savedSearch: SavedSearch;
}) {
  const href = buildSavedSearchHref(savedSearch);
  const filters = buildSavedSearchChips(dictionary, savedSearch);

  return (
    <article className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-foreground">{savedSearch.name}</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {filters.length > 0 ? filters.join(" · ") : dictionary.savedSearches.noFilters}
          </p>
        </div>
        <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">
          {savedSearch.notificationsEnabled ? dictionary.savedSearches.notificationsOn : dictionary.savedSearches.notificationsOff}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.length > 0 ? (
          filters.map((chip) => (
            <span className="rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-bold text-foreground" key={chip}>
              {chip}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-bold text-foreground">
            {dictionary.savedSearches.allListings}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground" href={href}>
          {dictionary.savedSearches.openSearch}
        </Link>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onToggleNotifications}>
          {isPending
            ? dictionary.savedSearches.updating
            : savedSearch.notificationsEnabled
              ? dictionary.savedSearches.turnNotificationsOff
              : dictionary.savedSearches.turnNotificationsOn}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onDelete}>
          {isPending ? dictionary.savedSearches.deleting : dictionary.savedSearches.delete}
        </Button>
      </div>
    </article>
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

function buildSavedSearchChips(dictionary: Dictionary, savedSearch: SavedSearch): string[] {
  return [
    savedSearch.q ? formatTemplate(dictionary.savedSearches.chips.query, savedSearch.q) : "",
    savedSearch.categoryId ? dictionary.savedSearches.selectedCategory : "",
    savedSearch.listingType ? formatTemplate(dictionary.savedSearches.chips.type, humanizeLabel(savedSearch.listingType)) : "",
    savedSearch.condition ? formatTemplate(dictionary.savedSearches.chips.condition, humanizeLabel(savedSearch.condition)) : "",
    savedSearch.priceMin ? formatTemplate(dictionary.savedSearches.chips.minPrice, savedSearch.priceMin) : "",
    savedSearch.priceMax ? formatTemplate(dictionary.savedSearches.chips.maxPrice, savedSearch.priceMax) : "",
    savedSearch.hasImages ? dictionary.savedSearches.imageOnly : "",
    savedSearch.sort && savedSearch.sort !== "newest" ? formatTemplate(dictionary.savedSearches.chips.sort, humanizeLabel(savedSearch.sort)) : ""
  ].filter(Boolean);
}

function buildSavedSearchMetrics(savedSearches: SavedSearch[]) {
  return savedSearches.reduce(
    (metrics, savedSearch) => {
      metrics.total += 1;

      if (savedSearch.notificationsEnabled) {
        metrics.notificationsOn += 1;
      } else {
        metrics.notificationsOff += 1;
      }

      return metrics;
    },
    {
      total: 0,
      notificationsOn: 0,
      notificationsOff: 0
    }
  );
}

function matchesFilter(savedSearch: SavedSearch, filter: SavedSearchFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "notifications_on") {
    return savedSearch.notificationsEnabled;
  }

  return !savedSearch.notificationsEnabled;
}

function sortSavedSearches(savedSearches: SavedSearch[]): SavedSearch[] {
  return [...savedSearches].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

function getFilterLabel(dictionary: Dictionary, filter: SavedSearchFilter): string {
  return dictionary.savedSearches.filters[filter];
}

function getFilterCount(
  metrics: ReturnType<typeof buildSavedSearchMetrics>,
  filter: SavedSearchFilter
): number {
  if (filter === "all") {
    return metrics.total;
  }

  if (filter === "notifications_on") {
    return metrics.notificationsOn;
  }

  return metrics.notificationsOff;
}

function appendParam(params: URLSearchParams, key: string, value: string): void {
  if (value.trim().length > 0) {
    params.set(key, value.trim());
  }
}

function humanizeLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function formatTemplate(template: string, value: string): string {
  return template.replace("{value}", value);
}

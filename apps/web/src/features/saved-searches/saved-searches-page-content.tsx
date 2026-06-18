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
    <PageContainer className="pb-12 pt-5" ariaLabel="Kayıtlı aramalar">
      <section className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="self-start rounded-[1.25rem] border border-border/70 bg-muted/25 p-3">
          <nav aria-label="Kayıtlı arama filtreleri" className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
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
                <span>{getFilterLabel(filter)}</span>
                <small className="mt-1 block text-xs font-bold text-muted-foreground">
                  {getFilterCount(metrics, filter)}
                </small>
              </button>
            ))}
          </nav>
        </aside>

        <div className="grid min-w-0 gap-4">
          <div className="rounded-[1.25rem] border border-border/70 bg-background p-4">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Kayıtlı aramalar</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Kaydettiğin aramaları buradan yönet.
            </p>
          </div>

          {errorMessage ? <Alert title="İşlem tamamlanamadı" message={errorMessage} /> : null}

          {isLoading || isCheckingAuth ? (
            <LoadingBlock title="Kayıtlı aramalar yükleniyor" message="Kaydettiğin filtreler hazırlanıyor." />
          ) : null}

          {!isLoading && savedSearches.length === 0 ? (
            <EmptyState
              title="Henüz kayıtlı arama yok"
              message="Browse sayfasından bir aramayı kaydedip burada tekrar açabilirsin."
              actionHref="/browse"
              actionLabel="İlanları keşfet"
            />
          ) : null}

          {!isLoading && savedSearches.length > 0 && sortedSavedSearches.length === 0 ? (
            <EmptyState
              title="Bu filtrede arama yok"
              message="Başka bir filtre seçebilir veya ilanları keşfedebilirsin."
              actionHref="/browse"
              actionLabel="İlanları keşfet"
            />
          ) : null}

          {!isLoading && sortedSavedSearches.length > 0 ? (
            <div className="grid gap-3">
              {sortedSavedSearches.map((savedSearch) => (
                <SavedSearchCard
                  isPending={pendingSavedSearchId === savedSearch.id}
                  key={savedSearch.id}
                  savedSearch={savedSearch}
                  onDelete={() => void handleDelete(savedSearch)}
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
  isPending,
  onDelete,
  savedSearch
}: {
  isPending: boolean;
  onDelete: () => void;
  savedSearch: SavedSearch;
}) {
  const href = buildSavedSearchHref(savedSearch);
  const filters = buildSavedSearchChips(savedSearch);

  return (
    <article className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-foreground">{savedSearch.name}</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {filters.length > 0 ? filters.join(" · ") : "Filtre yok"}
          </p>
        </div>
        <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">
          {savedSearch.notificationsEnabled ? "Bildirim açık" : "Bildirim kapalı"}
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
            Tüm ilanlar
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground" href={href}>
          Aramayı aç
        </Link>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onDelete}>
          {isPending ? "Siliniyor..." : "Sil"}
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

function buildSavedSearchChips(savedSearch: SavedSearch): string[] {
  return [
    savedSearch.q ? `Arama: ${savedSearch.q}` : "",
    savedSearch.categoryId ? "Kategori seçili" : "",
    savedSearch.listingType ? `Tip: ${humanizeLabel(savedSearch.listingType)}` : "",
    savedSearch.condition ? `Durum: ${humanizeLabel(savedSearch.condition)}` : "",
    savedSearch.priceMin ? `En az: ${savedSearch.priceMin}` : "",
    savedSearch.priceMax ? `En çok: ${savedSearch.priceMax}` : "",
    savedSearch.hasImages ? "Sadece görselli" : "",
    savedSearch.sort && savedSearch.sort !== "newest" ? `Sıralama: ${humanizeLabel(savedSearch.sort)}` : ""
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

function getFilterLabel(filter: SavedSearchFilter): string {
  const labels = {
    all: "Tüm kayıtlı aramalar",
    notifications_on: "Bildirim açık",
    notifications_off: "Bildirim kapalı"
  };

  return labels[filter];
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

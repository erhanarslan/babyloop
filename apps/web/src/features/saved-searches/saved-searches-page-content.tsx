"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
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
import { AccountSurfaceGuide } from "../account/account-surface-guide";
import {
  deleteSavedSearch,
  fetchSavedSearches,
  type SavedSearch
} from "./api";

type SavedSearchesPageContentProps = {
  apiBaseUrl: string;
};

type SavedSearchFilter = "all" | "keyword" | "priced" | "image_ready" | "notifications";

const FILTERS: SavedSearchFilter[] = ["all", "keyword", "priced", "image_ready", "notifications"];

const lifecycleSteps = [
  {
    title: "Capture",
    body: "Save one focused need at a time: category, price range, condition, and image preference."
  },
  {
    title: "Revisit",
    body: "Open saved searches when a child age band, season, size, or budget need becomes relevant again."
  },
  {
    title: "Refine",
    body: "Delete stale filters and rebuild the search when the need, category, or price range changes."
  }
];

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
  const filteredSavedSearches = useMemo(
    () => savedSearches.filter((savedSearch) => matchesFilter(savedSearch, activeFilter)),
    [activeFilter, savedSearches]
  );
  const sortedSavedSearches = useMemo(
    () => sortSavedSearches(filteredSavedSearches),
    [filteredSavedSearches]
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
    <>
      <PageHeading
        eyebrow="Saved searches"
        title="Saved search lifecycle"
        description="Track recurring baby and child needs with reusable marketplace filters, then reopen the right browse view when timing, age band, season, or budget changes."
      />

      <PageContainer className="saved-searches-lifecycle-layout listing-column" ariaLabel="Saved searches">
        <SavedSearchesHero />

        <section className="saved-search-lifecycle-grid" aria-label="Saved search lifecycle workflow">
          {lifecycleSteps.map((step, index) => (
            <Card as="article" className="saved-search-lifecycle-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </Card>
          ))}
        </section>

        <AccountSurfaceGuide kind="saved_searches" />

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

        {!isLoading && savedSearches.length > 0 ? (
          <section className="saved-searches-workspace" aria-label="Saved searches workspace">
            <SavedSearchesOverview metrics={metrics} />

            <div className="saved-search-filter-tabs" aria-label="Filter saved searches">
              {FILTERS.map((filter) => (
                <button
                  aria-pressed={activeFilter === filter}
                  className={activeFilter === filter ? "active" : ""}
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                >
                  {getFilterLabel(filter)}
                  <span>{getFilterCount(metrics, filter)}</span>
                </button>
              ))}
            </div>

            {sortedSavedSearches.length === 0 ? (
              <EmptyState
                title="No saved searches in this filter"
                message="Switch filters or create a new saved search from the marketplace browse page."
                actionHref="/browse"
                actionLabel="Create from browse"
              />
            ) : null}

            {sortedSavedSearches.length > 0 ? (
              <div className="saved-search-card-grid">
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
          </section>
        ) : null}
      </PageContainer>
    </>
  );
}

function SavedSearchesHero() {
  return (
    <Card as="section" className="saved-searches-hero" aria-label="Saved searches lifecycle overview">
      <div>
        <p className="eyebrow">Lifecycle tracking</p>
        <h2>Reuse marketplace filters when family needs come back around.</h2>
        <p>
          Saved searches turn recurring needs into reusable browse surfaces. Use them for age-band planning,
          seasonal needs, budget windows, category monitoring, and image-only review flows.
        </p>
        <div className="saved-searches-hero-actions">
          <Link href="/browse">Create from browse</Link>
          <Link href="/account/children">Age-band needs</Link>
          <Link href="/assistant?mode=age_needs&prompt=Help%20me%20turn%20child%20age-band%20needs%20into%20BabyLoop%20saved%20searches.">
            Ask lifecycle assistant
          </Link>
        </div>
      </div>

      <aside className="saved-searches-principles" aria-label="Saved search principles">
        <div>
          <span>One need</span>
          <strong>One focused saved search</strong>
        </div>
        <div>
          <span>Reusable</span>
          <strong>Open the same browse context again</strong>
        </div>
        <div>
          <span>Private</span>
          <strong>Saved to your account only</strong>
        </div>
      </aside>
    </Card>
  );
}

function SavedSearchesOverview({
  metrics
}: {
  metrics: ReturnType<typeof buildSavedSearchMetrics>;
}) {
  return (
    <Card as="section" className="saved-searches-overview" aria-label="Saved search summary">
      <div>
        <p className="eyebrow">Saved filter summary</p>
        <h2>Keep recurring needs specific</h2>
        <p>
          A useful saved search should explain what need it tracks, how narrow the filters are,
          and when it should be revisited.
        </p>
      </div>

      <div className="saved-search-metrics">
        <MetricCard label="Saved" value={metrics.total} />
        <MetricCard label="Keyword" value={metrics.keyword} />
        <MetricCard label="Priced" value={metrics.priced} />
        <MetricCard label="Images" value={metrics.imageReady} />
        <MetricCard label="Alerts" value={metrics.notifications} />
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="saved-search-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
  const chips = buildSavedSearchChips(savedSearch);
  const recommendation = buildSavedSearchRecommendation(savedSearch);
  const createdDate = formatSavedSearchDate(savedSearch.createdAt);
  const updatedDate = formatSavedSearchDate(savedSearch.updatedAt);

  return (
    <Card as="article" className="saved-search-lifecycle-item">
      <div className="saved-search-card-header">
        <div>
          <p className="listing-meta">Saved search · Created {createdDate}</p>
          <h2>{savedSearch.name}</h2>
        </div>
        <Badge tone={savedSearch.notificationsEnabled ? "success" : "neutral"}>
          {savedSearch.notificationsEnabled ? "Alerts on" : "Alerts off"}
        </Badge>
      </div>

      <div className="filter-chip-list saved-search-chip-list" aria-label="Saved search filters">
        {chips.length > 0 ? (
          chips.map((chip) => (
            <span className="filter-chip" key={chip}>{chip}</span>
          ))
        ) : (
          <span className="filter-chip">No filters</span>
        )}
      </div>

      <dl className="saved-search-facts">
        <div>
          <dt>Need type</dt>
          <dd>{getNeedType(savedSearch)}</dd>
        </div>
        <div>
          <dt>Price window</dt>
          <dd>{getPriceWindow(savedSearch)}</dd>
        </div>
        <div>
          <dt>Image preference</dt>
          <dd>{savedSearch.hasImages ? "Images only" : "Any listing"}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{updatedDate}</dd>
        </div>
      </dl>

      <div className="saved-search-recommendation">
        <strong>{recommendation.title}</strong>
        <p>{recommendation.body}</p>
      </div>

      <div className="saved-search-actions">
        <Link href={href}>Open browse results</Link>
        <Link href="/account/children">Age-band needs</Link>
        <Link href={`/assistant?mode=find_products&prompt=${encodeURIComponent(buildAssistantPrompt(savedSearch))}`}>
          Ask Assistant
        </Link>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onDelete}>
          {isPending ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </Card>
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
    savedSearch.categoryId ? `Category selected` : "",
    savedSearch.listingType ? `Type: ${humanizeLabel(savedSearch.listingType)}` : "",
    savedSearch.condition ? `Condition: ${humanizeLabel(savedSearch.condition)}` : "",
    savedSearch.priceMin ? `Min: ${savedSearch.priceMin}` : "",
    savedSearch.priceMax ? `Max: ${savedSearch.priceMax}` : "",
    savedSearch.hasImages ? "Images only" : "",
    savedSearch.sort && savedSearch.sort !== "newest" ? `Sort: ${humanizeLabel(savedSearch.sort)}` : ""
  ].filter(Boolean);
}

function buildSavedSearchMetrics(savedSearches: SavedSearch[]) {
  return savedSearches.reduce(
    (metrics, savedSearch) => {
      metrics.total += 1;

      if (savedSearch.q.trim().length > 0) {
        metrics.keyword += 1;
      }

      if (savedSearch.priceMin || savedSearch.priceMax) {
        metrics.priced += 1;
      }

      if (savedSearch.hasImages) {
        metrics.imageReady += 1;
      }

      if (savedSearch.notificationsEnabled) {
        metrics.notifications += 1;
      }

      return metrics;
    },
    {
      total: 0,
      keyword: 0,
      priced: 0,
      imageReady: 0,
      notifications: 0
    }
  );
}

function matchesFilter(savedSearch: SavedSearch, filter: SavedSearchFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "keyword") {
    return savedSearch.q.trim().length > 0;
  }

  if (filter === "priced") {
    return Boolean(savedSearch.priceMin || savedSearch.priceMax);
  }

  if (filter === "image_ready") {
    return savedSearch.hasImages;
  }

  return savedSearch.notificationsEnabled;
}

function sortSavedSearches(savedSearches: SavedSearch[]): SavedSearch[] {
  return [...savedSearches].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

function getFilterLabel(filter: SavedSearchFilter): string {
  const labels = {
    all: "All",
    keyword: "Keyword",
    priced: "Priced",
    image_ready: "Images",
    notifications: "Alerts"
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

  if (filter === "keyword") {
    return metrics.keyword;
  }

  if (filter === "priced") {
    return metrics.priced;
  }

  if (filter === "image_ready") {
    return metrics.imageReady;
  }

  return metrics.notifications;
}

function buildSavedSearchRecommendation(savedSearch: SavedSearch): {
  body: string;
  title: string;
} {
  const hasStrongFilters = Boolean(
    savedSearch.categoryId ||
    savedSearch.listingType ||
    savedSearch.condition ||
    savedSearch.priceMin ||
    savedSearch.priceMax ||
    savedSearch.hasImages
  );

  if (!hasStrongFilters && savedSearch.q.trim().length === 0) {
    return {
      title: "This search is broad",
      body: "Open browse and add category, condition, image, or price filters so this saved search tracks a real need."
    };
  }

  if (savedSearch.hasImages && (savedSearch.priceMin || savedSearch.priceMax)) {
    return {
      title: "Good decision filter",
      body: "Image and price filters make this useful for higher-review items. Reopen it when you are ready to compare options."
    };
  }

  if (savedSearch.categoryId && !savedSearch.priceMin && !savedSearch.priceMax) {
    return {
      title: "Category need saved",
      body: "This is useful for lifecycle tracking. Add a price window later if the result set becomes too broad."
    };
  }

  return {
    title: "Reusable browse context",
    body: "Use this saved search when the same need returns. Delete it when the child stage, season, or budget no longer matches."
  };
}

function getNeedType(savedSearch: SavedSearch): string {
  if (savedSearch.categoryId && savedSearch.q) {
    return "Category + keyword";
  }

  if (savedSearch.categoryId) {
    return "Category need";
  }

  if (savedSearch.q) {
    return "Keyword need";
  }

  return "General browse";
}

function getPriceWindow(savedSearch: SavedSearch): string {
  if (savedSearch.priceMin && savedSearch.priceMax) {
    return `${savedSearch.priceMin} - ${savedSearch.priceMax}`;
  }

  if (savedSearch.priceMin) {
    return `From ${savedSearch.priceMin}`;
  }

  if (savedSearch.priceMax) {
    return `Up to ${savedSearch.priceMax}`;
  }

  return "Any price";
}

function buildAssistantPrompt(savedSearch: SavedSearch): string {
  return `Help me use this BabyLoop saved search for a family need: ${savedSearch.name}. Filters: ${buildSavedSearchSummary(savedSearch)}. What should I compare before messaging a seller?`;
}

function formatSavedSearchDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown date";
  }

  return date.toLocaleDateString();
}

function appendParam(params: URLSearchParams, key: string, value: string): void {
  if (value.trim().length > 0) {
    params.set(key, value.trim());
  }
}

function humanizeLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\w/g, (letter) => letter.toUpperCase());
}

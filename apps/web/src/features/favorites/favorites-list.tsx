"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Card, EmptyState, LoadingBlock } from "../../components/ui";
import type { FavoriteListing } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { FavoriteCard } from "./favorite-card";
import { fetchFavorites, saveFavorite } from "./api";

type FavoritesListProps = {
  apiBaseUrl: string;
};

type FavoriteStatusFilter = "all" | "active" | "reserved" | "not_public";

const STATUS_FILTERS: FavoriteStatusFilter[] = ["all", "active", "reserved", "not_public"];

export function FavoritesList({ apiBaseUrl }: FavoritesListProps) {
  const { dictionary } = useI18n();
  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FavoriteStatusFilter>("all");

  const clearProtectedState = useCallback(() => {
    setFavorites([]);
    setMessage(null);
    setActionMessage(null);
    setPendingFavoriteId(null);
    setIsLoading(false);
  }, []);

  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  useEffect(() => {
    let isActive = true;

    async function loadFavorites() {
      if (!(await requireAuth())) {
        return;
      }

      try {
        const body = await fetchFavorites(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          setMessage(getApiErrorMessage(body.error, dictionary));
          return;
        }

        setFavorites(body.data.favorites);
      } catch {
        if (isActive) {
          setMessage(dictionary.common.apiUnavailable);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadFavorites();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary, requireAuth]);

  const metrics = useMemo(() => buildFavoriteMetrics(favorites), [favorites]);
  const filteredFavorites = useMemo(
    () =>
      favorites.filter((favorite) => {
        if (statusFilter === "all") {
          return true;
        }

        if (statusFilter === "not_public") {
          return !isPublicFavorite(favorite);
        }

        return favorite.status === statusFilter;
      }),
    [favorites, statusFilter]
  );
  const sortedFavorites = useMemo(
    () => sortFavorites(filteredFavorites),
    [filteredFavorites]
  );

  async function handleRemoveFavorite(favoriteId: string) {
    if (!(await requireAuth())) {
      return;
    }

    setActionMessage(null);
    setPendingFavoriteId(favoriteId);

    try {
      const body = await saveFavorite(apiBaseUrl, favoriteId, true);

      if (!body.ok) {
        setActionMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setFavorites((currentFavorites) =>
        currentFavorites.filter((favorite) => favorite.id !== favoriteId)
      );
    } catch {
      setActionMessage(dictionary.common.apiUnavailable);
    } finally {
      setPendingFavoriteId(null);
    }
  }

  if (isCheckingAuth || isLoading) {
    return <LoadingBlock title={dictionary.marketplace.loadingFavorites} />;
  }

  if (message) {
    return (
      <EmptyState
        title={dictionary.marketplace.favoritesUnavailable}
        message={message}
        actionHref="/login"
        actionLabel={dictionary.common.login}
      />
    );
  }

  if (favorites.length === 0) {
    return (
      <EmptyState
        title={dictionary.marketplace.favoritesEmptyTitle}
        message={dictionary.marketplace.favoritesEmptyBody}
        actionHref="/browse"
        actionLabel={dictionary.common.browseMarketplace}
      />
    );
  }

  return (
    <section className="favorites-workspace" aria-label="Saved listing decision workspace">
      <FavoritesOverview metrics={metrics} />

      <div className="favorite-status-tabs" aria-label="Filter saved listings by availability">
        {STATUS_FILTERS.map((status) => (
          <button
            aria-pressed={statusFilter === status}
            className={statusFilter === status ? "active" : ""}
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
          >
            {getFilterLabel(status)}
            <span>{getFilterCount(metrics, status)}</span>
          </button>
        ))}
      </div>

      {actionMessage ? (
        <Alert title={dictionary.marketplace.favoriteActionFailed} message={actionMessage} />
      ) : null}

      {sortedFavorites.length === 0 ? (
        <EmptyState
          title="No saved listings in this status"
          message="Switch filters or browse the marketplace to refresh your shortlist."
          actionHref="/browse"
          actionLabel={dictionary.common.browseMarketplace}
        />
      ) : null}

      {sortedFavorites.length > 0 ? (
        <div className="favorite-grid">
          {sortedFavorites.map((favorite) => (
            <FavoriteCard
              favorite={favorite}
              isPending={pendingFavoriteId === favorite.id}
              key={favorite.id}
              onRemove={() => {
                void handleRemoveFavorite(favorite.id);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FavoritesOverview({
  metrics
}: {
  metrics: ReturnType<typeof buildFavoriteMetrics>;
}) {
  return (
    <Card as="section" className="favorites-overview" aria-label="Saved listings summary">
      <div>
        <p className="eyebrow">Saved item summary</p>
        <h2>Keep the shortlist actionable</h2>
        <p>
          Revisit public listings first, remove stale items, and use saved searches for recurring needs
          that are not solved by the current shortlist.
        </p>
      </div>

      <div className="favorites-metrics">
        <MetricCard label="Saved" value={metrics.total} />
        <MetricCard label="Active" value={metrics.active} />
        <MetricCard label="Reserved" value={metrics.reserved} />
        <MetricCard label="Needs cleanup" value={metrics.notPublic} />
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="favorites-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildFavoriteMetrics(favorites: FavoriteListing[]) {
  return favorites.reduce(
    (metrics, favorite) => {
      metrics.total += 1;

      if (favorite.status === "active") {
        metrics.active += 1;
      } else if (favorite.status === "reserved") {
        metrics.reserved += 1;
      } else {
        metrics.notPublic += 1;
      }

      return metrics;
    },
    {
      total: 0,
      active: 0,
      reserved: 0,
      notPublic: 0
    }
  );
}

function sortFavorites(favorites: FavoriteListing[]): FavoriteListing[] {
  return [...favorites].sort((left, right) => {
    const leftPriority = getFavoritePriority(left);
    const rightPriority = getFavoritePriority(right);

    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return new Date(right.favoritedAt).getTime() - new Date(left.favoritedAt).getTime();
  });
}

function getFavoritePriority(favorite: FavoriteListing): number {
  if (favorite.status === "active") {
    return 3;
  }

  if (favorite.status === "reserved") {
    return 2;
  }

  return 1;
}

function isPublicFavorite(favorite: FavoriteListing): boolean {
  return favorite.status === "active" || favorite.status === "reserved";
}

function getFilterLabel(status: FavoriteStatusFilter): string {
  const labels = {
    all: "All",
    active: "Active",
    reserved: "Reserved",
    not_public: "Needs cleanup"
  };

  return labels[status];
}

function getFilterCount(
  metrics: ReturnType<typeof buildFavoriteMetrics>,
  status: FavoriteStatusFilter
): number {
  if (status === "all") {
    return metrics.total;
  }

  if (status === "active") {
    return metrics.active;
  }

  if (status === "reserved") {
    return metrics.reserved;
  }

  return metrics.notPublic;
}

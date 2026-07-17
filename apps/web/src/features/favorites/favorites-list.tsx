"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, EmptyState, LoadingBlock } from "../../components/ui";
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
        title="Henüz favori ilan yok."
        message="Beğendiğin ilanları favorilerine ekleyerek burada görebilirsin."
        actionHref="/browse"
        actionLabel="İlanları keşfet"
      />
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]" aria-label="Favoriler">
      <aside className="self-start rounded-[1.25rem] border border-border/70 bg-muted/25 p-3">
        <nav aria-label="Favori filtreleri" className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
          {STATUS_FILTERS.map((status) => (
            <button
              aria-pressed={statusFilter === status}
              className={[
                "min-w-[150px] rounded-2xl border px-3 py-2 text-left text-sm font-black transition lg:min-w-0",
                statusFilter === status
                  ? "border-primary/40 bg-background text-primary shadow-sm"
                  : "border-transparent text-foreground hover:bg-background/75"
              ].join(" ")}
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
            >
              <span>{getFilterLabel(status)}</span>
              <small className="mt-1 block text-xs font-bold text-muted-foreground">
                {getFilterCount(metrics, status)}
              </small>
            </button>
          ))}
        </nav>
      </aside>

      <div className="grid min-w-0 gap-4">
        <div className="rounded-[1.25rem] border border-border/70 bg-background p-4">
          <h1 className="text-2xl font-black tracking-tight text-foreground">Favoriler</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Beğendiğin ilanları hızlıca tekrar aç.
          </p>
        </div>

      {actionMessage ? (
        <Alert title={dictionary.marketplace.favoriteActionFailed} message={actionMessage} />
      ) : null}

      {sortedFavorites.length === 0 ? (
        <EmptyState
          title="Bu filtrede favori yok"
          message="Başka bir filtre seçebilir veya ilanları keşfedebilirsin."
          actionHref="/browse"
          actionLabel="İlanları keşfet"
        />
      ) : null}

      {sortedFavorites.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedFavorites.map((favorite) => (
            <FavoriteCard
              apiBaseUrl={apiBaseUrl}
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
      </div>
    </section>
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
  return (favorite.status === "active" || favorite.status === "reserved") && hasFavoriteImage(favorite);
}

function hasFavoriteImage(favorite: FavoriteListing): boolean {
  return Boolean(favorite.firstImage?.url ?? favorite.images?.[0]?.url);
}

function getFilterLabel(status: FavoriteStatusFilter): string {
  const labels = {
    all: "Tüm favoriler",
    active: "Aktif ilanlar",
    reserved: "Rezerve",
    not_public: "Satıldı / kaldırıldı"
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

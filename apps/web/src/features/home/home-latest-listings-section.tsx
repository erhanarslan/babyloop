"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent
} from "react";
import type {
  ListingImage,
  ListingsPayload,
  ListingSummary
} from "../../lib/api";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { AuthActionPromptModal } from "../auth/auth-action-prompt-modal";
import { fetchFavorites, saveFavorite } from "../favorites/api";
import { ListingImageFrame } from "../listings/listing-image-frame";
import {
  formatListingCondition,
  formatListingPrice,
  formatListingType
} from "../listings/listing-display";

type HomeLatestListingsSectionProps = {
  apiBaseUrl: string;
};

type ListingWithOptionalSeller = Omit<ListingSummary, "images"> & {
  images?: ListingImage[];
  seller?: {
    locationCity: string | null;
  };
};

type HomeListing = ListingWithOptionalSeller & {
  locationCity: string | null;
};

const INITIAL_LISTING_LIMIT = 4;
const LISTING_BATCH_SIZE = 16;
const AUTO_STOP_LISTING_COUNT = 80;
const IMAGE_HOVER_INTERVAL_MS = 1500;

export function HomeLatestListingsSection({ apiBaseUrl }: HomeLatestListingsSectionProps) {
  const { dictionary } = useI18n();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [listings, setListings] = useState<HomeListing[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMoreRemoteListings, setHasMoreRemoteListings] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [manualInfiniteEnabled, setManualInfiniteEnabled] = useState(false);
  const [favoriteListingIds, setFavoriteListingIds] = useState<Set<string>>(() => new Set());
  const [pendingFavoriteListingIds, setPendingFavoriteListingIds] = useState<Set<string>>(
    () => new Set()
  );
  const [favoriteActionMessage, setFavoriteActionMessage] = useState<string | null>(null);
  const [isFavoriteLoginPromptOpen, setIsFavoriteLoginPromptOpen] = useState(false);
  const [favoritePromptListingId, setFavoritePromptListingId] = useState<string | null>(null);

  const fetchListingBatch = useCallback(
    async (limit: number, offset: number): Promise<HomeListing[]> => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/listings?limit=${limit}&offset=${offset}&sort=newest&hasImages=true`,
        { cache: "no-store" }
      );
      const body = (await response.json()) as { ok: boolean; data?: ListingsPayload };

      if (!response.ok || !body.ok || !body.data) {
        throw new Error("Latest listings could not be loaded.");
      }

      return body.data.listings.map(toHomeListing);
    },
    [apiBaseUrl]
  );

  const appendListings = useCallback((nextListings: HomeListing[]) => {
    setListings((currentListings) => {
      const seenListingIds = new Set(currentListings.map((listing) => listing.id));
      const uniqueNextListings = nextListings.filter((listing) => !seenListingIds.has(listing.id));

      return [...currentListings, ...uniqueNextListings];
    });
  }, []);

  const loadFavoriteListingIds = useCallback(async () => {
    if (!(await getOrRefreshAuthToken(apiBaseUrl))) {
      setFavoriteListingIds(new Set());
      return;
    }

    try {
      const body = await fetchFavorites(apiBaseUrl);

      if (body.ok) {
        setFavoriteListingIds(new Set(body.data.favorites.map((favorite) => favorite.id)));
      }
    } catch {
      setFavoriteListingIds(new Set());
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadFavoriteListingIds();
  }, [loadFavoriteListingIds]);

  useEffect(() => {
    let isActive = true;

    async function loadInitialListings() {
      setIsInitialLoading(true);
      setIsLoadingMore(false);
      setHasError(false);
      setManualInfiniteEnabled(false);

      try {
        const firstListings = await fetchListingBatch(INITIAL_LISTING_LIMIT, 0);

        if (!isActive) {
          return;
        }

        setListings(firstListings);
        setNextOffset(firstListings.length);
        setHasMoreRemoteListings(firstListings.length === INITIAL_LISTING_LIMIT);
      } catch {
        if (isActive) {
          setHasError(true);
          setListings([]);
          setNextOffset(0);
          setHasMoreRemoteListings(false);
        }
      } finally {
        if (isActive) {
          setIsInitialLoading(false);
        }
      }
    }

    void loadInitialListings();

    return () => {
      isActive = false;
    };
  }, [fetchListingBatch]);

  const loadMoreListings = useCallback(
    async (mode: "auto" | "manual") => {
      if (isInitialLoading || isLoadingMore || !hasMoreRemoteListings) {
        return;
      }

      const isManualFlow = mode === "manual" || manualInfiniteEnabled;
      const remainingAutoCapacity = AUTO_STOP_LISTING_COUNT - listings.length;

      if (!isManualFlow && remainingAutoCapacity <= 0) {
        return;
      }

      const requestedLimit = isManualFlow
        ? LISTING_BATCH_SIZE
        : Math.min(LISTING_BATCH_SIZE, remainingAutoCapacity);

      setIsLoadingMore(true);
      setHasError(false);

      try {
        const nextListings = await fetchListingBatch(requestedLimit, nextOffset);

        appendListings(nextListings);
        setNextOffset((currentOffset) => currentOffset + nextListings.length);
        setHasMoreRemoteListings(nextListings.length === requestedLimit);
      } catch {
        setHasError(true);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [
      appendListings,
      fetchListingBatch,
      hasMoreRemoteListings,
      isInitialLoading,
      isLoadingMore,
      listings.length,
      manualInfiniteEnabled,
      nextOffset
    ]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry?.isIntersecting) {
          return;
        }

        if (isInitialLoading || isLoadingMore || !hasMoreRemoteListings) {
          return;
        }

        if (!manualInfiniteEnabled && listings.length >= AUTO_STOP_LISTING_COUNT) {
          return;
        }

        void loadMoreListings(manualInfiniteEnabled ? "manual" : "auto");
      },
      {
        root: null,
        rootMargin: "420px 0px",
        threshold: 0
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    hasMoreRemoteListings,
    isInitialLoading,
    isLoadingMore,
    listings.length,
    loadMoreListings,
    manualInfiniteEnabled
  ]);

  const shouldShowManualContinue =
    !manualInfiniteEnabled &&
    !isInitialLoading &&
    !isLoadingMore &&
    hasMoreRemoteListings &&
    listings.length >= AUTO_STOP_LISTING_COUNT;

  function continueAfterAutoStop() {
    setManualInfiniteEnabled(true);
    void loadMoreListings("manual");
  }

  function updateFavoriteListingIds(listingId: string, shouldBeFavorited: boolean) {
    setFavoriteListingIds((currentFavoriteListingIds) => {
      const nextFavoriteListingIds = new Set(currentFavoriteListingIds);

      if (shouldBeFavorited) {
        nextFavoriteListingIds.add(listingId);
      } else {
        nextFavoriteListingIds.delete(listingId);
      }

      return nextFavoriteListingIds;
    });
  }

  function updateFavoritePendingState(listingId: string, isPending: boolean) {
    setPendingFavoriteListingIds((currentPendingFavoriteListingIds) => {
      const nextPendingFavoriteListingIds = new Set(currentPendingFavoriteListingIds);

      if (isPending) {
        nextPendingFavoriteListingIds.add(listingId);
      } else {
        nextPendingFavoriteListingIds.delete(listingId);
      }

      return nextPendingFavoriteListingIds;
    });
  }

  function updateListingFavoriteCount(listingId: string, shouldBeFavorited: boolean) {
    setListings((currentListings) =>
      currentListings.map((listing) => {
        if (listing.id !== listingId) {
          return listing;
        }

        return {
          ...listing,
          favoriteCount: Math.max(listing.favoriteCount + (shouldBeFavorited ? 1 : -1), 0)
        };
      })
    );
  }

  async function handleFavoriteToggle(listingId: string, isFavorited: boolean) {
    setFavoriteActionMessage(null);

    if (pendingFavoriteListingIds.has(listingId)) {
      return;
    }

    if (!(await getOrRefreshAuthToken(apiBaseUrl))) {
      setFavoritePromptListingId(listingId);
      setIsFavoriteLoginPromptOpen(true);
      return;
    }

    const shouldBeFavorited = !isFavorited;

    updateFavoritePendingState(listingId, true);
    updateFavoriteListingIds(listingId, shouldBeFavorited);
    updateListingFavoriteCount(listingId, shouldBeFavorited);

    try {
      const body = await saveFavorite(apiBaseUrl, listingId, isFavorited);

      if (!body.ok) {
        updateFavoriteListingIds(listingId, isFavorited);
        updateListingFavoriteCount(listingId, isFavorited);
        setFavoriteActionMessage(getApiErrorMessage(body.error, dictionary));
      }
    } catch {
      updateFavoriteListingIds(listingId, isFavorited);
      updateListingFavoriteCount(listingId, isFavorited);
      setFavoriteActionMessage(dictionary.common.apiUnavailable);
    } finally {
      updateFavoritePendingState(listingId, false);
    }
  }

  return (
    <section className="home-latest-listings-section" id="latest-listings">
      <div className="home-latest-listings-heading">
        <div>
          <p className="eyebrow">Son eklenen ürünler</p>
        </div>

        <Link href="/browse?sort=newest">Tümünü gör</Link>
      </div>

      {favoriteActionMessage ? (
        <div className="home-latest-listings-inline-state" role="status">
          <span>{favoriteActionMessage}</span>
        </div>
      ) : null}

      {isInitialLoading ? (
        <div className="home-latest-listings-state">
          <span>Son ilanlar yükleniyor...</span>
        </div>
      ) : null}

      {!isInitialLoading && hasError && listings.length === 0 ? (
        <div className="home-latest-listings-state">
          <span>Son ilanlar şu anda yüklenemedi.</span>
        </div>
      ) : null}

      {!isInitialLoading && !hasError && listings.length === 0 ? (
        <div className="home-latest-listings-state">
          <span>Henüz ilan yok. İlk ilanı sen oluştur.</span>
          <Link href="/sell">İlan oluştur</Link>
        </div>
      ) : null}

      {listings.length > 0 ? (
        <>
          <div className="home-latest-listings-grid">
            {listings.map((listing) => (
              <HomeProductCard
                apiBaseUrl={apiBaseUrl}
                dictionary={dictionary}
                isFavoritePending={pendingFavoriteListingIds.has(listing.id)}
                isFavorited={favoriteListingIds.has(listing.id)}
                key={listing.id}
                listing={listing}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>

          <div ref={sentinelRef} className="home-latest-listings-sentinel" aria-hidden="true" />

          {isLoadingMore ? (
            <div className="home-latest-listings-inline-state">
              <span>Diğer ürünler yükleniyor...</span>
            </div>
          ) : null}

          {shouldShowManualContinue ? (
            <div className="home-latest-listings-actions">
              <button type="button" onClick={continueAfterAutoStop}>
                Devamını gör
                <span aria-hidden="true">↓</span>
              </button>
            </div>
          ) : null}

          {!hasMoreRemoteListings && !isLoadingMore ? (
            <div className="home-latest-listings-actions">
              <Link href="/browse?sort=newest">
                Diğer ilanları gör
                <span aria-hidden="true">›</span>
              </Link>
            </div>
          ) : null}
        </>
      ) : null}
      <AuthActionPromptModal
        apiBaseUrl={apiBaseUrl}
        isOpen={isFavoriteLoginPromptOpen}
        title="Favoriye eklemek için giriş yapmalısın"
        onAuthenticated={() => {
          const listingId = favoritePromptListingId;

          setIsFavoriteLoginPromptOpen(false);
          setFavoritePromptListingId(null);

          if (listingId) {
            void handleFavoriteToggle(listingId, favoriteListingIds.has(listingId));
          }
        }}
        onClose={() => {
          setIsFavoriteLoginPromptOpen(false);
          setFavoritePromptListingId(null);
        }}
      />
    </section>
  );
}

type HomeProductCardProps = {
  apiBaseUrl: string;
  dictionary: ReturnType<typeof useI18n>["dictionary"];
  isFavoritePending: boolean;
  isFavorited: boolean;
  listing: HomeListing;
  onFavoriteToggle: (listingId: string, isFavorited: boolean) => void | Promise<void>;
};

function HomeProductCard({
  apiBaseUrl,
  dictionary,
  isFavoritePending,
  isFavorited,
  listing,
  onFavoriteToggle
}: HomeProductCardProps) {
  const images = getListingCardImages(listing);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (!isHovering || images.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveImageIndex((currentIndex) => (currentIndex + 1) % images.length);
    }, IMAGE_HOVER_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [images.length, isHovering]);

  function handleMouseEnter() {
    if (images.length <= 1) {
      return;
    }

    setIsHovering(true);
  }

  function handleMouseLeave() {
    setIsHovering(false);
    setActiveImageIndex(0);
  }

  function handleFavoriteClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    void onFavoriteToggle(listing.id, isFavorited);
  }

  return (
    <article
      className="home-product-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className={`home-product-card-favorite${isFavorited ? " is-favorited" : ""}`}
        aria-label={isFavorited ? "Favorilerden çıkar" : "Favorilere ekle"}
        aria-pressed={isFavorited}
        disabled={isFavoritePending}
        onClick={handleFavoriteClick}
      >
        <span aria-hidden="true">{isFavorited ? "♥" : "♡"}</span>
      </button>

      <Link className="home-product-card-link" href={`/listings/${listing.id}`}>
        <ListingImageFrame
          alt={listing.title}
          apiBaseUrl={apiBaseUrl}
          className="home-product-card-image"
          fallbackLabel="BabyLoop"
          url={images[activeImageIndex]?.url ?? null}
        />

        <div className="home-product-card-body">
          <div>
            <strong>{formatListingPrice(listing.price, dictionary)}</strong>
            <h3>{listing.title}</h3>
          </div>

          <p>{listing.locationCity ?? listing.category.name}</p>

          <div className="home-product-card-badges">
            <span>{formatListingCondition(listing.condition, dictionary)}</span>
            <span>{formatListingType(listing.listingType, dictionary)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function getListingCardImages(listing: HomeListing): ListingImage[] {
  const images = Array.isArray(listing.images) ? listing.images : [];

  if (images.length > 0) {
    return images.slice(0, 5);
  }

  return listing.firstImage ? [listing.firstImage] : [];
}

function toHomeListing(listing: ListingSummary): HomeListing {
  const listingWithSeller = listing as ListingWithOptionalSeller;

  return {
    ...listingWithSeller,
    locationCity: listingWithSeller.seller?.locationCity ?? null
  };
}

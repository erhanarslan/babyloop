"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ListingsPayload,
  ListingSummary
} from "../../lib/api";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { ListingImageFrame } from "../listings/listing-image-frame";
import {
  formatListingCondition,
  formatListingPrice,
  formatListingType
} from "../listings/listing-display";

type HomeLatestListingsSectionProps = {
  apiBaseUrl: string;
};

type ListingWithOptionalSeller = ListingSummary & {
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

  const fetchListingBatch = useCallback(
    async (limit: number, offset: number): Promise<HomeListing[]> => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/listings?limit=${limit}&offset=${offset}&sort=newest`,
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

  return (
    <section className="home-latest-listings-section" id="latest-listings">
      <div className="home-latest-listings-heading">
        <div>
          <p className="eyebrow">Son eklenen ürünler</p>
        </div>

        <Link href="/browse?sort=newest">Tümünü gör</Link>
      </div>

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
              <Link
                className="home-product-card"
                href={`/listings/${listing.id}`}
                key={listing.id}
              >
                <ListingImageFrame
                  alt={listing.title}
                  apiBaseUrl={apiBaseUrl}
                  className="home-product-card-image"
                  fallbackLabel="BabyLoop"
                  url={listing.firstImage?.url ?? null}
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
    </section>
  );
}

function toHomeListing(listing: ListingSummary): HomeListing {
  const listingWithSeller = listing as ListingWithOptionalSeller;

  return {
    ...listingWithSeller,
    locationCity: listingWithSeller.seller?.locationCity ?? null
  };
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  ListingDetailPayload,
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

type LatestListingRotatorProps = {
  apiBaseUrl: string;
};

type RotatorListing = ListingSummary & {
  locationCity: string | null;
};

const ROTATION_INTERVAL_MS = 2500;

export function LatestListingRotator({ apiBaseUrl }: LatestListingRotatorProps) {
  const { dictionary } = useI18n();
  const [listings, setListings] = useState<RotatorListing[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    function handleMotionPreferenceChange(event: MediaQueryListEvent) {
      setPrefersReducedMotion(event.matches);
    }

    mediaQuery.addEventListener("change", handleMotionPreferenceChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMotionPreferenceChange);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadLatestListings() {
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/listings?limit=3&sort=newest`, {
          cache: "no-store"
        });
        const body = (await response.json()) as { ok: boolean; data?: ListingsPayload };

        if (!isActive) {
          return;
        }

        if (!response.ok || !body.ok || !body.data) {
          setHasError(true);
          setListings([]);
          return;
        }

        const summaries = body.data.listings.slice(0, 3);
        const enrichedListings = await Promise.all(
          summaries.map(async (listing) => enrichListingWithCity(apiBaseUrl, listing))
        );

        if (isActive) {
          setListings(enrichedListings);
          setActiveIndex(0);
        }
      } catch {
        if (isActive) {
          setHasError(true);
          setListings([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadLatestListings();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (prefersReducedMotion || isPaused || listings.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % listings.length);
    }, ROTATION_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isPaused, listings.length, prefersReducedMotion]);

  const activeListing = listings[activeIndex] ?? listings[0] ?? null;

  return (
    <section
      className="latest-listing-rotator"
      aria-label={dictionary.publicPages.home.latestListingsTitle}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="latest-listing-rotator-heading">
        <h2>{dictionary.publicPages.home.latestListingsTitle}</h2>
        <Link href="/browse">{dictionary.publicPages.home.browseCta}</Link>
      </div>

      {isLoading ? (
        <div className="latest-listing-placeholder-card">
          <span>{dictionary.publicPages.home.latestListingsLoading}</span>
        </div>
      ) : null}

      {!isLoading && hasError ? (
        <div className="latest-listing-placeholder-card">
          <span>{dictionary.publicPages.home.latestListingsUnavailable}</span>
        </div>
      ) : null}

      {!isLoading && !hasError && !activeListing ? (
        <div className="latest-listing-placeholder-card">
          <span>{dictionary.publicPages.home.latestListingsEmpty}</span>
        </div>
      ) : null}

      {activeListing ? (
        <>
          <Link className="latest-listing-active-card" href={`/listings/${activeListing.id}`}>
            <ListingImageFrame
              alt={activeListing.title}
              apiBaseUrl={apiBaseUrl}
              className="latest-listing-image"
              fallbackLabel="BabyLoop"
              url={activeListing.firstImage?.url ?? null}
            />
            <div className="latest-listing-card-body">
              <div>
                <strong>{formatListingPrice(activeListing.price, dictionary)}</strong>
                <h3>{activeListing.title}</h3>
              </div>
              <p>{activeListing.locationCity ?? dictionary.common.notProvided}</p>
              <div className="latest-listing-badges">
                <span>{formatListingCondition(activeListing.condition, dictionary)}</span>
                <span>{formatListingType(activeListing.listingType, dictionary)}</span>
              </div>
            </div>
          </Link>

          <div className="latest-listing-stack" aria-label={dictionary.publicPages.home.latestListingsTitle}>
            {listings.map((listing, index) => (
              <button
                aria-pressed={index === activeIndex}
                key={listing.id}
                type="button"
                onClick={() => setActiveIndex(index)}
              >
                <ListingImageFrame
                  alt={listing.title}
                  apiBaseUrl={apiBaseUrl}
                  className="latest-listing-thumb"
                  fallbackLabel="BabyLoop"
                  url={listing.firstImage?.url ?? null}
                />
                <span>{listing.title}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

async function enrichListingWithCity(
  apiBaseUrl: string,
  listing: ListingSummary
): Promise<RotatorListing> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/listings/${listing.id}`, {
      cache: "no-store"
    });
    const body = (await response.json()) as { ok: boolean; data?: ListingDetailPayload };

    if (!response.ok || !body.ok || !body.data) {
      return { ...listing, locationCity: null };
    }

    return {
      ...listing,
      firstImage: body.data.listing.images[0] ?? listing.firstImage,
      locationCity: body.data.listing.seller.locationCity
    };
  } catch {
    return { ...listing, locationCity: null };
  }
}

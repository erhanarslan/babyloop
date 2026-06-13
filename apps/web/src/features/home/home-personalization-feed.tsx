"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, LoadingBlock } from "../../components/ui";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import {
  fetchLifecycleRecommendations,
  type LifecycleRecommendationGroup
} from "../child-profiles/api";
import {
  getRecentlyViewedListings,
  type RecentlyViewedListing
} from "../listings/recently-viewed-storage";
import {
  fetchSavedSearches,
  type SavedSearch
} from "../saved-searches/api";

type HomePersonalizationFeedProps = {
  apiBaseUrl: string;
};

export function HomePersonalizationFeed({ apiBaseUrl }: HomePersonalizationFeedProps) {
  const { dictionary } = useI18n();
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedListing[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [lifecycleGroups, setLifecycleGroups] = useState<LifecycleRecommendationGroup[]>([]);
  const [isLoadingPrivateFeed, setIsLoadingPrivateFeed] = useState(true);
  const [hasAuthenticatedFeed, setHasAuthenticatedFeed] = useState(false);

  useEffect(() => {
    function refreshRecentlyViewed() {
      setRecentlyViewed(getRecentlyViewedListings().slice(0, 4));
    }

    refreshRecentlyViewed();
    window.addEventListener("babyloop:recently-viewed-listings-updated", refreshRecentlyViewed);

    return () => {
      window.removeEventListener("babyloop:recently-viewed-listings-updated", refreshRecentlyViewed);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadPrivateFeed() {
      setIsLoadingPrivateFeed(true);

      const token = await getOrRefreshAuthToken(apiBaseUrl);

      if (!isActive) {
        return;
      }

      if (!token) {
        setHasAuthenticatedFeed(false);
        setSavedSearches([]);
        setLifecycleGroups([]);
        setIsLoadingPrivateFeed(false);
        return;
      }

      setHasAuthenticatedFeed(true);

      const [savedSearchesResponse, lifecycleResponse] = await Promise.all([
        fetchSavedSearches(apiBaseUrl),
        fetchLifecycleRecommendations(apiBaseUrl)
      ]);

      if (!isActive) {
        return;
      }

      setSavedSearches(savedSearchesResponse.ok ? savedSearchesResponse.data.savedSearches.slice(0, 3) : []);
      setLifecycleGroups(lifecycleResponse.ok ? lifecycleResponse.data.groups.slice(0, 3) : []);
      setIsLoadingPrivateFeed(false);
    }

    void loadPrivateFeed();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl]);

  const hasAnyPersonalSignal =
    recentlyViewed.length > 0 || savedSearches.length > 0 || hasLifecycleRecommendations(lifecycleGroups);

  return (
    <section className="home-section home-personalization-feed" aria-label="Personalized BabyLoop feed">
      <div className="home-section-heading">
        <p className="eyebrow">Personalized marketplace</p>
        <h2>Continue where your family needs are evolving</h2>
        <p>
          BabyLoop combines recently viewed listings, saved searches, and age-band lifecycle suggestions
          without exposing buyer identity or private contact data.
        </p>
      </div>

      {isLoadingPrivateFeed ? (
        <LoadingBlock title="Preparing your home feed" message="Loading saved searches and lifecycle suggestions when available." />
      ) : null}

      {!isLoadingPrivateFeed && !hasAnyPersonalSignal ? (
        <div className="home-personalization-empty">
          <Card as="article" className="home-personalization-card">
            <p className="eyebrow">Start discovery</p>
            <h3>Browse categories and save useful searches</h3>
            <p>
              Open listings, create saved searches, or add child age bands to make this home feed more useful.
            </p>
            <div className="home-personalization-actions">
              <Link href="/browse">{dictionary.common.browseMarketplace}</Link>
              <Link href="/account/children">Add child profiles</Link>
              <Link href="/sell">{dictionary.common.createListing}</Link>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="home-personalization-grid">
        <RecentlyViewedHomeCard listings={recentlyViewed} />
        <LifecycleHomeCard groups={lifecycleGroups} hasAuthenticatedFeed={hasAuthenticatedFeed} />
        <SavedSearchesHomeCard savedSearches={savedSearches} hasAuthenticatedFeed={hasAuthenticatedFeed} />
        <SellerActionHomeCard />
      </div>
    </section>
  );
}

function RecentlyViewedHomeCard({ listings }: { listings: RecentlyViewedListing[] }) {
  return (
    <Card as="article" className="home-personalization-card">
      <div className="home-card-heading-row">
        <div>
          <p className="eyebrow">Recently viewed</p>
          <h3>Pick up from your last browse</h3>
        </div>
        <Badge>{listings.length}</Badge>
      </div>

      {listings.length === 0 ? (
        <p className="muted">Listings you open will appear here for faster rediscovery.</p>
      ) : (
        <ul className="home-feed-list">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Link href={`/listings/${listing.id}`}>{listing.title}</Link>
              <span>{listing.category.name}</span>
            </li>
          ))}
        </ul>
      )}

      <Link className="home-feed-link" href="/browse">
        Browse marketplace
      </Link>
    </Card>
  );
}

function LifecycleHomeCard({
  groups,
  hasAuthenticatedFeed
}: {
  groups: LifecycleRecommendationGroup[];
  hasAuthenticatedFeed: boolean;
}) {
  const suggestions = groups.flatMap((group) =>
    group.recommendations.slice(0, 2).map((recommendation) => ({
      ...recommendation,
      groupLabel: group.childProfileLabel
    }))
  ).slice(0, 4);

  return (
    <Card as="article" className="home-personalization-card">
      <div className="home-card-heading-row">
        <div>
          <p className="eyebrow">Lifecycle suggestions</p>
          <h3>Age-band category ideas</h3>
        </div>
        <Badge>{suggestions.length}</Badge>
      </div>

      {!hasAuthenticatedFeed ? (
        <p className="muted">Sign in and add child age bands to unlock lifecycle category suggestions.</p>
      ) : null}

      {hasAuthenticatedFeed && suggestions.length === 0 ? (
        <p className="muted">Add or resume a child profile to see category suggestions here.</p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="home-feed-list">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.groupLabel}-${suggestion.categoryId}`}>
              <Link href={`/categories/${suggestion.categorySlug}`}>{suggestion.categoryName}</Link>
              <span>{suggestion.reasonLabel}</span>
              <span>{suggestion.whyNow}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Link className="home-feed-link" href="/account/children">
        Manage child profiles
      </Link>
    </Card>
  );
}

function SavedSearchesHomeCard({
  savedSearches,
  hasAuthenticatedFeed
}: {
  savedSearches: SavedSearch[];
  hasAuthenticatedFeed: boolean;
}) {
  return (
    <Card as="article" className="home-personalization-card">
      <div className="home-card-heading-row">
        <div>
          <p className="eyebrow">Saved searches</p>
          <h3>Reuse useful filters</h3>
        </div>
        <Badge>{savedSearches.length}</Badge>
      </div>

      {!hasAuthenticatedFeed ? (
        <p className="muted">Sign in to save and reuse marketplace filters.</p>
      ) : null}

      {hasAuthenticatedFeed && savedSearches.length === 0 ? (
        <p className="muted">Save a browse filter set to keep it one click away.</p>
      ) : null}

      {savedSearches.length > 0 ? (
        <ul className="home-feed-list">
          {savedSearches.map((savedSearch) => (
            <li key={savedSearch.id}>
              <Link href={buildSavedSearchHref(savedSearch)}>{savedSearch.name}</Link>
              <span>{buildSavedSearchSummary(savedSearch)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Link className="home-feed-link" href="/account/saved-searches">
        View saved searches
      </Link>
    </Card>
  );
}

function SellerActionHomeCard() {
  return (
    <Card as="article" className="home-personalization-card">
      <div className="home-card-heading-row">
        <div>
          <p className="eyebrow">Seller tools</p>
          <h3>Improve listings with AI and stats</h3>
        </div>
        <Badge>AI</Badge>
      </div>

      <p className="muted">
        Create listings faster with AI draft and price suggestions, then follow aggregate seller insights.
      </p>

      <div className="home-personalization-actions">
        <Link href="/sell">Create listing</Link>
        <Link href="/account/seller">Seller dashboard</Link>
      </div>
    </Card>
  );
}

function hasLifecycleRecommendations(groups: LifecycleRecommendationGroup[]): boolean {
  return groups.some((group) => group.recommendations.length > 0);
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
  const parts = [
    savedSearch.q ? `Search: ${savedSearch.q}` : "",
    savedSearch.listingType ? `Type: ${savedSearch.listingType}` : "",
    savedSearch.condition ? `Condition: ${savedSearch.condition}` : "",
    savedSearch.priceMin ? `Min: ${savedSearch.priceMin}` : "",
    savedSearch.priceMax ? `Max: ${savedSearch.priceMax}` : "",
    savedSearch.hasImages ? "Images only" : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "No filters";
}

function appendParam(params: URLSearchParams, key: string, value: string): void {
  if (value.trim().length > 0) {
    params.set(key, value.trim());
  }
}

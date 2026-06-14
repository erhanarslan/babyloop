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
          BabyLoop turns browsing signals into a practical parent workspace: recently viewed listings,
          saved searches, lifecycle recommendations, and seller next steps stay connected without exposing
          buyer identity or private contact data.
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
              <Link href="/assistant">Ask Assistant</Link>
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

type LifecycleSuggestion = LifecycleRecommendationGroup["recommendations"][number] & {
  ageBand: LifecycleRecommendationGroup["ageBand"];
  childProfileId: string;
  groupLabel: string;
};

function LifecycleHomeCard({
  groups,
  hasAuthenticatedFeed
}: {
  groups: LifecycleRecommendationGroup[];
  hasAuthenticatedFeed: boolean;
}) {
  const activeGroups = groups.filter((group) => group.recommendations.length > 0);
  const primaryGroup = activeGroups[0] ?? null;
  const suggestions: LifecycleSuggestion[] = activeGroups.flatMap((group) =>
    group.recommendations.slice(0, 3).map((recommendation) => ({
      ...recommendation,
      ageBand: group.ageBand,
      childProfileId: group.childProfileId,
      groupLabel: group.childProfileLabel
    }))
  ).slice(0, 5);

  return (
    <Card as="article" className="home-personalization-card">
      <div className="home-card-heading-row">
        <div>
          <p className="eyebrow">Upcoming needs</p>
          <h3>
            {primaryGroup
              ? buildParentMilestoneTitle(primaryGroup)
              : "Plan the next useful items"}
          </h3>
        </div>
        <Badge>{suggestions.length}</Badge>
      </div>

      {!hasAuthenticatedFeed ? (
        <p className="muted">
          Sign in and add a child age band to get a lightweight needs list for the current stage.
        </p>
      ) : null}

      {hasAuthenticatedFeed && !primaryGroup ? (
        <p className="muted">
          Add or resume a child profile to see a stage-based list of upcoming product needs.
        </p>
      ) : null}

      {primaryGroup ? (
        <p className="muted">
          {buildParentMilestoneDescription(primaryGroup)}
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="home-feed-list">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.childProfileId}-${suggestion.categoryId}`}>
              <Link href={`/categories/${suggestion.categorySlug}`}>
                {suggestion.categoryName}
              </Link>
              <span>{suggestion.whyNow}</span>
              <span>
                {suggestion.reasonLabel} · {formatLifecycleConfidence(suggestion.reasoningConfidenceScore)} confidence
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="home-personalization-actions">
        <Link href="/account/children">Manage child profiles</Link>
        <Link href="/guides">Parent guides</Link>
      </div>
    </Card>
  );
}

function buildParentMilestoneTitle(group: LifecycleRecommendationGroup): string {
  return `${group.childProfileLabel} is in the ${formatLifecycleAgeBand(group.ageBand)} stage`;
}

function buildParentMilestoneDescription(group: LifecycleRecommendationGroup): string {
  return `BabyLoop prepared a privacy-light needs list for this stage using only the saved age band, not an exact birth date.`;
}

function formatLifecycleAgeBand(ageBand: LifecycleRecommendationGroup["ageBand"]): string {
  switch (ageBand) {
    case "expecting":
      return "expecting";
    case "newborn_0_3":
      return "0-3 month";
    case "infant_3_6":
      return "3-6 month";
    case "infant_6_12":
      return "6-12 month";
    case "toddler_12_24":
      return "12-24 month";
    case "preschool_24_36":
      return "24-36 month";
    case "child_3_plus":
      return "3+ year";
  }
}

function formatLifecycleConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
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
          <h3>Turn outgrown items into clear, safer listings</h3>
        </div>
        <Badge>AI</Badge>
      </div>

      <p className="muted">
        Start with guided listing details, AI draft help, price suggestions, and aggregate seller insights
        so the next family understands condition, pickup context, and value.
      </p>

      <div className="home-personalization-actions">
        <Link href="/sell">Create listing</Link>
        <Link href="/assistant?mode=sell_help&prompt=Help%20me%20prepare%20a%20clear%20BabyLoop%20listing.">Ask seller assistant</Link>
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

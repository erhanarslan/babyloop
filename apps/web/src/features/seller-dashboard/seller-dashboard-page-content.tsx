"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  LoadingBlock,
  PageContainer,
  PageHeading
} from "../../components/ui";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  fetchSellerDashboard,
  type SellerDashboardSummary
} from "./api";

type SellerDashboardPageContentProps = {
  apiBaseUrl: string;
};

type SellerListingInsight = SellerDashboardSummary["listings"][number];

type FunnelMetric = {
  label: string;
  value: number;
  helper: string;
};

type InsightCard = {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
  tone: "success" | "warning" | "neutral";
};

export function SellerDashboardPageContent({ apiBaseUrl }: SellerDashboardPageContentProps) {
  const { dictionary } = useI18n();
  const { isCheckingAuth } = useProtectedRoute({ apiBaseUrl });
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    let isActive = true;

    async function loadSellerDashboard() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await fetchSellerDashboard(apiBaseUrl);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error as ApiError, dictionary));
        setSummary(null);
        setIsLoading(false);
        return;
      }

      setSummary(response.data.summary);
      setIsLoading(false);
    }

    void loadSellerDashboard();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary, isCheckingAuth]);

  const funnelMetrics = useMemo(
    () => (summary ? buildFunnelMetrics(summary) : []),
    [summary]
  );
  const opportunityCards = useMemo(
    () => (summary ? buildOpportunityCards(summary) : []),
    [summary]
  );
  const sortedListings = useMemo(
    () => (summary ? sortSellerListings(summary.listings) : []),
    [summary]
  );

  return (
    <>
      <PageHeading
        eyebrow="Seller dashboard"
        title="Your privacy-safe seller insights"
        description="Read aggregate listing performance, spot weak conversion points, and improve seller actions without exposing buyer identity, message bodies, or contact details."
      />

      <PageContainer className="seller-dashboard-layout listing-column" ariaLabel="Seller dashboard">
        <SellerDashboardHero />

        {errorMessage ? (
          <Alert title="Seller dashboard unavailable" message={errorMessage} />
        ) : null}

        {isCheckingAuth || isLoading ? (
          <LoadingBlock title="Loading seller dashboard" message="Preparing your listing insights." />
        ) : null}

        {summary ? (
          <>
            <section className="seller-dashboard-kpi-grid" aria-label="Seller dashboard totals">
              <SummaryCard label="Listings" value={summary.totals.totalListings} helper="All seller listings" />
              <SummaryCard label="Active" value={summary.totals.activeListings} helper="Visible and actionable" />
              <SummaryCard label="Reserved" value={summary.totals.reservedListings} helper="Temporarily held" />
              <SummaryCard label="Sold" value={summary.totals.soldListings} helper="Completed lifecycle" />
              <SummaryCard label="Archived" value={summary.totals.archivedListings} helper="Removed from public flow" />
              <SummaryCard label="Favorites" value={summary.totals.totalFavorites} helper="Saved by buyers" />
              <SummaryCard label="Detail views" value={summary.totals.listingDetailViews} helper="Listing detail demand" />
              <SummaryCard label="Contact intents" value={summary.totals.contactSellerIntents} helper="Message-start signals" />
            </section>

            <Card as="section" className="seller-funnel-panel" aria-label="Seller conversion funnel">
              <div className="seller-dashboard-section-heading">
                <div>
                  <p className="eyebrow">Aggregate funnel</p>
                  <h2>Understand where buyer interest slows down</h2>
                  <p>
                    These are product-event totals only. They do not reveal who viewed, favorited,
                    clicked, or intended to contact you.
                  </p>
                </div>
                <Badge>Privacy-safe</Badge>
              </div>

              <div className="seller-funnel-grid">
                {funnelMetrics.map((metric) => (
                  <div className="seller-funnel-step" key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.helper}</small>
                  </div>
                ))}
              </div>
            </Card>

            <section className="seller-opportunity-grid" aria-label="Seller action recommendations">
              {opportunityCards.map((card) => (
                <Card as="article" className={`seller-opportunity-card ${card.tone}`} key={card.title}>
                  <Badge tone={card.tone}>{card.tone === "success" ? "Healthy" : card.tone === "warning" ? "Improve" : "Review"}</Badge>
                  <h2>{card.title}</h2>
                  <p>{card.body}</p>
                  <Link href={card.actionHref}>{card.actionLabel}</Link>
                </Card>
              ))}
            </section>

            {summary.listings.length === 0 ? (
              <EmptyState
                title="No seller listings yet"
                message="Create your first listing to start collecting seller insights."
                actionHref="/sell"
                actionLabel="Create listing"
              />
            ) : null}

            {sortedListings.length > 0 ? (
              <section className="seller-listing-insights" aria-label="Seller listing stats">
                <div className="seller-dashboard-section-heading">
                  <div>
                    <p className="eyebrow">Listing insights</p>
                    <h2>Prioritize listings by demand and next action</h2>
                    <p>
                      Use listing-level totals to decide whether to improve photos, update price/title,
                      reserve, archive, or compare the public buyer view.
                    </p>
                  </div>
                  <Link href="/my-listings">Manage listings</Link>
                </div>

                {sortedListings.map((listing) => (
                  <ListingInsightCard listing={listing} key={listing.listingId} />
                ))}
              </section>
            ) : null}
          </>
        ) : null}
      </PageContainer>
    </>
  );
}

function SellerDashboardHero() {
  return (
    <Card as="section" className="seller-dashboard-hero" aria-label="Seller dashboard overview">
      <div>
        <p className="eyebrow">Seller analytics</p>
        <h2>Turn listing signals into practical seller actions.</h2>
        <p>
          Track aggregate demand, compare listing quality, and decide what to improve next while
          keeping buyer identity, contact details, and private messages out of analytics.
        </p>
        <div className="seller-dashboard-actions">
          <Link href="/sell">Create listing</Link>
          <Link href="/my-listings">Manage listings</Link>
          <Link href="/assistant?mode=sell_help&prompt=Help%20me%20improve%20my%20BabyLoop%20seller%20dashboard%20signals.">
            Ask seller assistant
          </Link>
        </div>
      </div>

      <aside className="seller-dashboard-principles" aria-label="Seller dashboard principles">
        <div>
          <span>Signals</span>
          <strong>Views, clicks, favorites, contact intents</strong>
        </div>
        <div>
          <span>Privacy</span>
          <strong>No buyer identity or message body</strong>
        </div>
        <div>
          <span>Action</span>
          <strong>Improve, reserve, sell, archive</strong>
        </div>
      </aside>
    </Card>
  );
}

function SummaryCard({
  helper,
  label,
  value
}: {
  helper: string;
  label: string;
  value: number;
}) {
  return (
    <Card as="article" className="seller-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </Card>
  );
}

function ListingInsightCard({ listing }: { listing: SellerListingInsight }) {
  const recommendation = getListingRecommendation(listing);
  const isPublic = listing.status === "active" || listing.status === "reserved";

  return (
    <Card as="article" className="seller-listing-insight-card">
      <div className="seller-listing-insight-header">
        <div>
          <p className="listing-meta">
            {listing.categoryName} · {formatDashboardStatus(listing.status)} · Created {formatDashboardDate(listing.createdAt)}
          </p>
          <h2>{listing.title}</h2>
        </div>
        <Badge tone={recommendation.tone}>{recommendation.label}</Badge>
      </div>

      <dl className="seller-listing-insight-metrics">
        <div>
          <dt>Favorites</dt>
          <dd>{listing.favoriteCount}</dd>
        </div>
        <div>
          <dt>Detail views</dt>
          <dd>{listing.detailViews}</dd>
        </div>
        <div>
          <dt>Listing clicks</dt>
          <dd>{listing.listingClicks}</dd>
        </div>
        <div>
          <dt>Contact intents</dt>
          <dd>{listing.contactSellerIntents}</dd>
        </div>
      </dl>

      <div className="seller-listing-recommendation">
        <strong>{recommendation.title}</strong>
        <p>{recommendation.body}</p>
      </div>

      <div className="seller-listing-insight-actions">
        <Link href="/my-listings">Manage status</Link>
        <Link href={`/categories/${listing.categorySlug}`}>Compare category</Link>
        {isPublic ? (
          <Link href={`/listings/${listing.listingId}`}>Open public view</Link>
        ) : (
          <span className="muted">Not public</span>
        )}
      </div>
    </Card>
  );
}

function buildFunnelMetrics(summary: SellerDashboardSummary): FunnelMetric[] {
  const views = summary.totals.listingDetailViews;
  const clicks = summary.totals.listingClicks;
  const contacts = summary.totals.contactSellerIntents;
  const favorites = summary.totals.totalFavorites;

  return [
    {
      label: "Detail views",
      value: views,
      helper: "People opened listing detail pages."
    },
    {
      label: "Listing clicks",
      value: clicks,
      helper: `${formatPercent(clicks, views)} of detail views led to listing clicks.`
    },
    {
      label: "Favorites",
      value: favorites,
      helper: `${formatPercent(favorites, views)} of detail views became saved items.`
    },
    {
      label: "Contact intents",
      value: contacts,
      helper: `${formatPercent(contacts, views)} of detail views created seller-contact intent.`
    }
  ];
}

function buildOpportunityCards(summary: SellerDashboardSummary): InsightCard[] {
  const hasListings = summary.totals.totalListings > 0;
  const hasViews = summary.totals.listingDetailViews > 0;
  const hasContact = summary.totals.contactSellerIntents > 0;
  const archivedRatio = summary.totals.totalListings > 0
    ? summary.totals.archivedListings / summary.totals.totalListings
    : 0;

  return [
    {
      title: hasListings ? "Keep availability current" : "Create your first seller signal",
      body: hasListings
        ? "Use active, reserved, sold, and archived states intentionally so buyers do not waste time on unavailable listings."
        : "Publish a clear listing with photos and condition notes to start collecting aggregate seller insights.",
      actionHref: hasListings ? "/my-listings" : "/sell",
      actionLabel: hasListings ? "Manage listings" : "Create listing",
      tone: hasListings ? "success" : "neutral"
    },
    {
      title: hasViews && !hasContact ? "Views exist, contact intent is weak" : "Watch buyer intent quality",
      body: hasViews && !hasContact
        ? "Listings are being viewed but not turning into seller-contact intent. Improve photos, condition clarity, price, and pickup expectations."
        : "Contact intent should be read with favorites and views together, not as buyer identity or private conversation data.",
      actionHref: "/my-listings",
      actionLabel: "Review listing quality",
      tone: hasViews && !hasContact ? "warning" : hasContact ? "success" : "neutral"
    },
    {
      title: archivedRatio > 0.5 ? "Many listings are archived" : "Use dashboard with seller workflow",
      body: archivedRatio > 0.5
        ? "A high archived share can be healthy cleanup, but active inventory may need refreshing if you still want buyer activity."
        : "Use dashboard metrics to decide whether to update listing quality, then use My listings for lifecycle changes.",
      actionHref: "/assistant?mode=sell_help&prompt=Help%20me%20interpret%20my%20BabyLoop%20seller%20dashboard%20signals.",
      actionLabel: "Ask seller assistant",
      tone: archivedRatio > 0.5 ? "warning" : "neutral"
    }
  ];
}

function sortSellerListings(listings: SellerListingInsight[]): SellerListingInsight[] {
  return [...listings].sort((left, right) => {
    const rightScore = scoreSellerListing(right);
    const leftScore = scoreSellerListing(left);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function scoreSellerListing(listing: SellerListingInsight): number {
  return (
    listing.contactSellerIntents * 10 +
    listing.favoriteCount * 5 +
    listing.detailViews * 2 +
    listing.listingClicks
  );
}

function getListingRecommendation(listing: SellerListingInsight): {
  body: string;
  label: string;
  title: string;
  tone: "success" | "warning" | "neutral";
} {
  if (listing.status === "sold") {
    return {
      label: "Closed",
      title: "Sold listing",
      body: "This listing has completed its seller lifecycle. Keep it sold or archive when it no longer needs operational attention.",
      tone: "success"
    };
  }

  if (listing.status === "archived") {
    return {
      label: "Archived",
      title: "Not public",
      body: "Archived listings do not need buyer-facing optimization unless you plan to reactivate them.",
      tone: "neutral"
    };
  }

  if (listing.detailViews > 0 && listing.contactSellerIntents === 0) {
    return {
      label: "Improve",
      title: "Interest is not converting",
      body: "Buyers are opening the listing but not showing contact intent. Recheck photos, condition, title, price, and pickup clarity.",
      tone: "warning"
    };
  }

  if (listing.favoriteCount > 0 && listing.contactSellerIntents === 0) {
    return {
      label: "Shortlisted",
      title: "Saved but not contacted",
      body: "Favorites can mean buyer interest. Add clearer details or review price if the listing is saved but not contacted.",
      tone: "warning"
    };
  }

  if (listing.contactSellerIntents > 0) {
    return {
      label: "Healthy",
      title: "Contact intent exists",
      body: "Buyer intent is visible as an aggregate signal. Keep responses clear and update status when reserved or sold.",
      tone: "success"
    };
  }

  return {
    label: "Review",
    title: "Needs more signal",
    body: "This listing has limited aggregate activity. Compare category positioning and consider improving photos or title clarity.",
    tone: "neutral"
  };
}

function getConversionRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function formatPercent(numerator: number, denominator: number): string {
  return `${Math.round(getConversionRate(numerator, denominator) * 100)}%`;
}

function formatDashboardDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown date";
  }

  return date.toLocaleDateString();
}

function formatDashboardStatus(status: string): string {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminProductAnalyticsEventName,
  type AdminProductAnalyticsSummary,
  getAdminProductAnalyticsSummary,
} from "./api";

export function ProductAnalyticsDashboard() {
  const [summary, setSummary] = useState<AdminProductAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSummary() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminProductAnalyticsSummary();

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setSummary(null);
        setErrorMessage(
          getApiErrorMessage(response, "Could not load product analytics."),
        );
        setIsLoading(false);
        return;
      }

      setSummary(response.data.summary);
      setIsLoading(false);
    }

    void loadSummary();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">Product Analytics</p>
          <h2>Marketplace discovery signals</h2>
          <p>
            Aggregate-only product analytics for listing views, category views, search result
            buckets, and recently-viewed clicks. Raw search queries, user identity, email, phone,
            referrer, and user agent are not shown.
          </p>
        </div>
        <Link className="secondary-action" href="/listings">
          Open listings
        </Link>
      </div>

      {isLoading ? <div className="state-panel">Loading product analytics...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="Product analytics summary">
            <SummaryCard label="Events 24h" value={summary.totals.eventsLast24Hours} />
            <SummaryCard label="Events 7d" value={summary.totals.eventsLast7Days} />
            <SummaryCard label="Detail views 7d" value={summary.totals.listingDetailViewsLast7Days} />
            <SummaryCard label="Category views 7d" value={summary.totals.categoryViewsLast7Days} />
            <SummaryCard label="Searches 7d" value={summary.totals.searchesLast7Days} />
            <SummaryCard label="Recent clicks 7d" value={summary.totals.recentlyViewedClicksLast7Days} />
            <SummaryCard label="All events" value={summary.totals.totalEvents} />
          </section>

          <section className="module-grid" aria-label="Product analytics breakdowns">
            <article className="module-card dashboard-module-card">
              <h3>Event breakdown</h3>
              <p>All-time product event counts by privacy-safe event type.</p>
              <dl className="compact-details">
                {summary.eventCounts.length === 0 ? (
                  <div className="state-panel">No product events recorded yet.</div>
                ) : (
                  summary.eventCounts.map((item) => (
                    <div key={item.eventType}>
                      <dt>{formatEventName(item.eventType)}</dt>
                      <dd>{item.count}</dd>
                    </div>
                  ))
                )}
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Source breakdown</h3>
              <p>Top event sources such as browse, category landing, listing detail, and recently viewed.</p>
              <dl className="compact-details">
                {summary.sourceCounts.length === 0 ? (
                  <div className="state-panel">No source data recorded yet.</div>
                ) : (
                  summary.sourceCounts.map((item) => (
                    <div key={item.source}>
                      <dt>{formatSource(item.source)}</dt>
                      <dd>{item.count}</dd>
                    </div>
                  ))
                )}
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Search result buckets</h3>
              <p>Search activity grouped by result-count bucket, without storing raw search terms.</p>
              <dl className="compact-details">
                {summary.searchResultBuckets.length === 0 ? (
                  <div className="state-panel">No search events recorded yet.</div>
                ) : (
                  summary.searchResultBuckets.map((item) => (
                    <div key={item.resultBucket}>
                      <dt>{item.resultBucket}</dt>
                      <dd>{item.count}</dd>
                    </div>
                  ))
                )}
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Top categories 7d</h3>
              <p>Categories receiving the most explicit category view events.</p>
              <div className="table-list">
                {summary.topCategories.length === 0 ? (
                  <div className="state-panel">No category view events recorded yet.</div>
                ) : (
                  summary.topCategories.map((category) => (
                    <div className="table-list-row" key={category.categoryId}>
                      <div>
                        <strong>{category.categoryName}</strong>
                        <p className="muted">{category.categorySlug}</p>
                      </div>
                      <small className="muted">{category.viewCount} views</small>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Top listings 7d</h3>
              <p>Listings with the most product interaction events.</p>
              <div className="table-list">
                {summary.topListings.length === 0 ? (
                  <div className="state-panel">No listing interaction events recorded yet.</div>
                ) : (
                  summary.topListings.map((listing) => (
                    <div className="table-list-row" key={listing.listingId}>
                      <div>
                        <strong>{listing.title}</strong>
                        <p className="muted">
                          {listing.categoryName} · {listing.categorySlug}
                        </p>
                      </div>
                      <small className="muted">{listing.eventCount} events</small>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatEventName(eventType: AdminProductAnalyticsEventName): string {
  return eventType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSource(source: string): string {
  return source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.message ?? fallback;
}

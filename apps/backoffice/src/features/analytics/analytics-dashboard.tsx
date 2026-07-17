"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useState } from "react";

import {
  type BackofficeAnalyticsOverview,
  type BackofficeAnalyticsPageRow,
  getBackofficeAnalyticsOverview,
  getBackofficeAnalyticsPages
} from "./analytics-api";
import { buildAnalyticsOverviewKpis, formatDuration } from "./analytics-dashboard-model";

export function AnalyticsDashboard() {
  const [overview, setOverview] = useState<BackofficeAnalyticsOverview | null>(null);
  const [pages, setPages] = useState<BackofficeAnalyticsPageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      setIsLoading(true);
      setErrorMessage(null);

      const [overviewResponse, pagesResponse] = await Promise.all([
        getBackofficeAnalyticsOverview(),
        getBackofficeAnalyticsPages()
      ]);

      if (!active) {
        return;
      }

      if (!overviewResponse.ok) {
        setOverview(null);
        setPages([]);
        setErrorMessage(getApiErrorMessage(overviewResponse, "Could not load analytics."));
        setIsLoading(false);
        return;
      }

      setOverview(overviewResponse.data.overview);
      setPages(pagesResponse.ok ? pagesResponse.data.pages : []);
      setIsLoading(false);
    }

    void loadAnalytics();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2>Genel Bakış</h2>
          <p>
            Aggregate first-party product analytics. Raw messages, assistant prompts, child note
            text, tokens, cookies, exact IP and raw query strings are not shown.
          </p>
        </div>
      </div>

      {isLoading ? <div className="state-panel">Loading analytics...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {overview ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="Analytics overview">
            {buildAnalyticsOverviewKpis(overview).map((card) => (
              <div className="summary-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            ))}
          </section>

          <section className="module-grid" aria-label="Analytics breakdowns">
            <article className="module-card dashboard-module-card">
              <h3>Data freshness</h3>
              <dl className="compact-details">
                <div>
                  <dt>Last rollup</dt>
                  <dd>{overview.lastRollupAt ? new Date(overview.lastRollupAt).toLocaleString("tr-TR") : "Not available"}</dd>
                </div>
                <div>
                  <dt>Timezone</dt>
                  <dd>Europe/Istanbul display, UTC storage</dd>
                </div>
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Pages and screens</h3>
              <div className="table-list">
                {pages.length === 0 ? (
                  <div className="state-panel">No page or screen aggregate data yet.</div>
                ) : (
                  pages.map((page) => (
                    <div className="table-list-row" key={`${page.platform}-${page.surface}`}>
                      <div>
                        <strong>{page.surface}</strong>
                        <p className="muted">
                          {page.platform} · {page.views} views · {page.uniqueUsers} users
                        </p>
                      </div>
                      <small className="muted">
                        avg {formatDuration(page.averageEngagementMs)} · p90 {formatDuration(page.p90EngagementMs)}
                      </small>
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

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.message ?? fallback;
}

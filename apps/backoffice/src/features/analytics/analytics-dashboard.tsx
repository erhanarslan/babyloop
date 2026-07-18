"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
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
        setErrorMessage(getApiErrorMessage(overviewResponse, "Analytics verisi yüklenemedi."));
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
          <p className="eyebrow">Analitik</p>
          <h2>Genel Bakış</h2>
          <p>
            First-party product analytics yalnızca aggregate görünürlük sağlar. Raw messages
            (ham mesajlar), asistan prompt’u, çocuk notu, token, cookie, exact IP ve raw query string gösterilmez.
          </p>
        </div>
      </div>

      {isLoading ? <div className="state-panel">Analytics verisi yükleniyor...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {overview ? (
        <>
          <nav className="module-grid" aria-label="Analytics bölümleri">
            {analyticsSectionLinks.map(({ href, label }) => (
              <Link className="module-card dashboard-module-card" href={href} key={href}>
                <h3>{label}</h3>
              </Link>
            ))}
          </nav>

          <section className="summary-grid dashboard-summary-grid" aria-label="Analytics genel bakış">
            {buildAnalyticsOverviewKpis(overview).map((card) => (
              <div className="summary-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            ))}
          </section>

          <section className="module-grid" aria-label="Analytics kırılımları">
            <article className="module-card dashboard-module-card">
              <h3>Veri tazeliği</h3>
              <dl className="compact-details">
                <div>
                  <dt>Son rollup</dt>
                  <dd>{overview.lastRollupAt ? new Date(overview.lastRollupAt).toLocaleString("tr-TR") : "Henüz yok"}</dd>
                </div>
                <div>
                  <dt>Zaman dilimi</dt>
                  <dd>Europe/Istanbul gösterim, UTC saklama</dd>
                </div>
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Sayfalar ve ekranlar</h3>
              <div className="table-list">
                {pages.length === 0 ? (
                  <div className="state-panel">Henüz sayfa veya ekran aggregate verisi yok.</div>
                ) : (
                  pages.map((page) => (
                    <div className="table-list-row" key={`${page.platform}-${page.surface}`}>
                      <div>
                        <strong>{page.surface}</strong>
                        <p className="muted">
                          {page.platform} · {page.views} görüntüleme · {page.uniqueUsers} kullanıcı
                        </p>
                      </div>
                      <small className="muted">
                        ort. {formatDuration(page.averageEngagementMs)} · p90 {formatDuration(page.p90EngagementMs)}
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

const analyticsSectionLinks: Array<{ href: string; label: string }> = [
  { href: "/analytics/users", label: "Kullanıcılar" },
  { href: "/analytics/auth", label: "Auth & Doğrulama" },
  { href: "/analytics/engagement", label: "Etkileşim" },
  { href: "/analytics/marketplace", label: "Pazaryeri" },
  { href: "/analytics/messaging", label: "Mesajlaşma" },
  { href: "/analytics/assistant", label: "Asistan & RAG" },
  { href: "/analytics/child", label: "Çocuk & Hatırlatıcılar" },
  { href: "/analytics/funnels", label: "Dönüşüm Hunileri" },
  { href: "/analytics/data-quality", label: "Veri Kalitesi" }
];

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.message ?? fallback;
}

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
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";
import { EmptyState, LoadingState, RecoverableError, StaleDataState } from "../shared/async-state";

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
            Birinci taraf ürün analitiği, son dönem ham olaylarını ve toplama güncelliğini birlikte gösterir.
            Mesaj gövdesi, asistan sorusu, çocuk notu, token, çerez, tam IP ve ham sorgu metni gösterilmez.
          </p>
        </div>
      </div>

      {isLoading ? <LoadingState title="Analitik verileri yükleniyor…" /> : null}

      {errorMessage ? (
        <RecoverableError title="Analitik verileri alınamadı" description={errorMessage} />
      ) : null}

      {overview ? (
        <>
          <nav className="module-grid" aria-label="Analitik bölümleri">
            {analyticsSectionLinks.map(({ href, label }) => (
              <Link className="module-card dashboard-module-card" href={href} key={href}>
                <h3>{label}</h3>
              </Link>
            ))}
          </nav>

          <section className="summary-grid dashboard-summary-grid" aria-label="Analitik genel bakış">
            {buildAnalyticsOverviewKpis(overview).map((card) => (
              <div className="summary-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <ul className="compact-list">
                  {card.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
                <small className="muted">{card.period} · {card.source}</small>
              </div>
            ))}
          </section>

          {overview.aggregationStatus === "pending" ? (
            <StaleDataState lastUpdated={overview.lastRollupAt ? formatDateTimeTr(overview.lastRollupAt) : null} />
          ) : null}

          <section className="module-grid" aria-label="Analitik kırılımları">
            <article className="module-card dashboard-module-card">
              <h3>Veri tazeliği</h3>
              <dl className="compact-details">
                <div>
                  <dt>Son toplama</dt>
                  <dd>{overview.lastRollupAt ? formatDateTimeTr(overview.lastRollupAt) : "Henüz tamamlanmadı"}</dd>
                </div>
                <div>
                  <dt>Son ham olay</dt>
                  <dd>{overview.lastRawEventAt ? formatDateTimeTr(overview.lastRawEventAt) : "Henüz olay yok"}</dd>
                </div>
                <div>
                  <dt>Ham olay sayısı</dt>
                  <dd>{overview.rawEventsInRange}</dd>
                </div>
                <div>
                  <dt>Veri kaynağı</dt>
                  <dd>{overview.dataSource === "raw_recent" ? "Son dönem ham olayları" : formatEnumLabel(overview.dataSource)}</dd>
                </div>
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Sayfalar ve ekranlar</h3>
              <div className="table-list">
                {pages.length === 0 ? (
                  <EmptyState title="Henüz sayfa veya ekran olayı yok" description="Olay oluştuğunda görünür yüzeyler burada listelenir." />
                ) : (
                  pages.map((page) => (
                    <div className="table-list-row" key={`${page.platform}-${page.surface}`}>
                      <div>
                        <strong>{page.surface}</strong>
                        <p className="muted">
                          {formatEnumLabel(page.platform)} · {page.views} görüntüleme · {page.uniqueUsers} kullanıcı
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
  { href: "/analytics/auth", label: "Kimlik ve Doğrulama" },
  { href: "/analytics/engagement", label: "Etkileşim" },
  { href: "/analytics/marketplace", label: "Pazaryeri" },
  { href: "/analytics/messaging", label: "Mesajlaşma" },
  { href: "/analytics/assistant", label: "Asistan ve RAG" },
  { href: "/analytics/child", label: "Çocuk ve Hatırlatıcılar" },
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

  return response.error?.code === "FORBIDDEN"
    ? "Analitik genel bakışını görüntüleme yetkin yok."
    : fallback;
}

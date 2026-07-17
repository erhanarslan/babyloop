"use client";

import { useEffect, useState } from "react";

import {
  getBackofficeAnalyticsEngagement,
  getBackofficeAnalyticsFunnels,
  getBackofficeAnalyticsAuth,
  getBackofficeAnalyticsDataQuality,
  getBackofficeAnalyticsMarketplace,
  getBackofficeAnalyticsSection,
  type BackofficeAnalyticsCategoryRow,
  type BackofficeAnalyticsFunnel,
  type BackofficeAnalyticsPageRow,
  type BackofficeAnalyticsSection
} from "./analytics-api";
import { formatDuration } from "./analytics-dashboard-model";

type AnalyticsSectionPageProps = {
  kind:
    | "users"
    | "auth"
    | "engagement"
    | "marketplace"
    | "messaging"
    | "assistant"
    | "child"
    | "funnels"
    | "data-quality";
  title: string;
};

export function AnalyticsSectionPage({ kind, title }: AnalyticsSectionPageProps) {
  const [section, setSection] = useState<BackofficeAnalyticsSection | null>(null);
  const [pages, setPages] = useState<BackofficeAnalyticsPageRow[]>([]);
  const [categories, setCategories] = useState<BackofficeAnalyticsCategoryRow[]>([]);
  const [funnels, setFunnels] = useState<BackofficeAnalyticsFunnel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const result = await loadSection(kind);

      if (!active) {
        return;
      }

      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }

      setSection(result.section ?? null);
      setPages(result.pages ?? []);
      setCategories(result.categories ?? []);
      setFunnels(result.funnels ?? []);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [kind]);

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">Analitik</p>
          <h2>{title}</h2>
          <p>Yalnız aggregate metrikler gösterilir. Hassas event property’leri ve serbest kullanıcı metni render edilmez.</p>
        </div>
      </div>

      {loading ? <div className="state-panel">Analytics verisi yükleniyor...</div> : null}
      {error ? <div className="state-panel danger" role="alert">{error}</div> : null}

      {section ? (
        <section className="summary-grid dashboard-summary-grid" aria-label={`${title} metrics`}>
          {section.metrics.map((metric) => (
            <div className="summary-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{formatMetric(metric.value, metric.unit)}</strong>
            </div>
          ))}
        </section>
      ) : null}

      {pages.length > 0 ? (
        <article className="module-card dashboard-module-card">
          <h3>Sayfalar ve ekranlar</h3>
          {pages.map((page) => (
            <div className="table-list-row" key={`${page.platform}-${page.surface}`}>
              <div>
                <strong>{page.surface}</strong>
                <p className="muted">{page.platform} · {page.views} görüntüleme · {page.uniqueUsers} kullanıcı</p>
              </div>
              <small className="muted">ort. {formatDuration(page.averageEngagementMs)} · p90 {formatDuration(page.p90EngagementMs)}</small>
            </div>
          ))}
        </article>
      ) : null}

      {categories.length > 0 ? (
        <article className="module-card dashboard-module-card">
          <h3>Kategoriler</h3>
          {categories.map((category) => (
            <div className="table-list-row" key={`${category.platform}-${category.categoryId}`}>
              <div>
                <strong>{category.categoryName}</strong>
                <p className="muted">{category.platform} · {category.listingViews} ilan görüntüleme · {category.favorites} favori</p>
              </div>
              <small className="muted">{category.conversationsStarted} sohbet · {category.checkoutCompleted} checkout</small>
            </div>
          ))}
        </article>
      ) : null}

      {funnels.length > 0 ? (
        <article className="module-card dashboard-module-card">
          <h3>Dönüşüm hunileri</h3>
          {funnels.map((funnel) => (
            <div className="table-list-row" key={funnel.name}>
              <div>
                <strong>{funnel.name}</strong>
                <p className="muted">
                  {funnel.steps.map((step) => `${step.label}: ${step.users}`).join(" · ")}
                </p>
              </div>
            </div>
          ))}
        </article>
      ) : null}
    </section>
  );
}

async function loadSection(kind: AnalyticsSectionPageProps["kind"]): Promise<{
  ok: true;
  categories?: BackofficeAnalyticsCategoryRow[];
  funnels?: BackofficeAnalyticsFunnel[];
  pages?: BackofficeAnalyticsPageRow[];
  section?: BackofficeAnalyticsSection;
} | {
  ok: false;
  message: string;
}> {
  if (kind === "engagement") {
    const response = await getBackofficeAnalyticsEngagement();
    return response.ok
      ? { ok: true, pages: response.data.engagement.pages, section: response.data.engagement.summary }
      : { ok: false, message: response.error.message };
  }

  if (kind === "marketplace") {
    const response = await getBackofficeAnalyticsMarketplace();
    return response.ok
      ? { ok: true, categories: response.data.marketplace.categories, section: response.data.marketplace.summary }
      : { ok: false, message: response.error.message };
  }

  if (kind === "funnels") {
    const response = await getBackofficeAnalyticsFunnels();
    return response.ok
      ? { ok: true, funnels: response.data.funnels }
      : { ok: false, message: response.error.message };
  }

  if (kind === "auth") {
    const response = await getBackofficeAnalyticsAuth();

    if (!response.ok) {
      return { ok: false, message: response.error.message };
    }

    const totals = response.data.auth.reduce(
      (accumulator, row) => ({
        approvalCompletions: accumulator.approvalCompletions + row.approvalCompletions,
        emailVerifications: accumulator.emailVerifications + row.emailVerifications,
        failedLogins: accumulator.failedLogins + row.failedLogins,
        mfaCompletions: accumulator.mfaCompletions + row.mfaCompletions,
        registrations: accumulator.registrations + row.registrations,
        successfulLogins: accumulator.successfulLogins + row.successfulLogins
      }),
      {
        approvalCompletions: 0,
        emailVerifications: 0,
        failedLogins: 0,
        mfaCompletions: 0,
        registrations: 0,
        successfulLogins: 0
      }
    );

    return {
      ok: true,
      section: {
        title: "Auth & Doğrulama",
        metrics: [
          { label: "Kayıt", value: totals.registrations },
          { label: "Başarılı login", value: totals.successfulLogins },
          { label: "Başarısız login", value: totals.failedLogins },
          { label: "E-posta doğrulama", value: totals.emailVerifications },
          { label: "MFA tamamlama", value: totals.mfaCompletions },
          { label: "Mobil onay", value: totals.approvalCompletions }
        ]
      }
    };
  }

  if (kind === "data-quality") {
    const response = await getBackofficeAnalyticsDataQuality();

    if (!response.ok) {
      return { ok: false, message: response.error.message };
    }

    return {
      ok: true,
      section: {
        title: "Veri Kalitesi",
        metrics: [
          { label: "Raw event", value: response.data.dataQuality.rawEventsLast7Days },
          { label: "Tekrarlı event", value: response.data.dataQuality.duplicateEventsLast7Days },
          { label: "Reddedilen", value: response.data.dataQuality.rejectedEventsLast7Days },
          { label: "Session eksik", value: response.data.dataQuality.missingSessionIdsLast7Days },
          { label: "Bilinmeyen versiyon", value: response.data.dataQuality.unknownEventVersionsLast7Days }
        ]
      }
    };
  }

  const response = await getBackofficeAnalyticsSection(kind);

  return response.ok
    ? { ok: true, section: response.data.section }
    : { ok: false, message: response.error.message };
}

function formatMetric(value: number, unit: BackofficeAnalyticsSection["metrics"][number]["unit"]): string {
  if (unit === "percent") {
    return `${value}%`;
  }

  if (unit === "milliseconds") {
    return formatDuration(value);
  }

  return new Intl.NumberFormat("tr-TR").format(value);
}

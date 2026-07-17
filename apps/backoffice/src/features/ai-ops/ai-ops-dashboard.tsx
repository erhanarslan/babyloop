"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  type AdminAiOpsFeature,
  type AdminAiOpsRunSummary,
  type AdminAiOpsRunsParams,
  type AdminAiOpsStatus,
  type AdminAiOpsSummary,
  getAdminAiOpsSummary,
  listAdminAiOpsRuns,
} from "./api";

type AiOpsFilters = {
  feature: AdminAiOpsFeature;
  q: string;
  status: "all" | AdminAiOpsStatus;
  sort: "newest" | "oldest";
  limit: number;
};

const defaultFilters: AiOpsFilters = {
  feature: "moderation_summary",
  q: "",
  status: "all",
  sort: "newest",
  limit: 50,
};

const featureOptions: AdminAiOpsFeature[] = [
  "moderation_summary",
  "listing_image_authenticity",
];

const statusOptions: Array<"all" | AdminAiOpsStatus> = [
  "all",
  "success",
  "error",
  "provider_failed",
  "validation_failed",
  "skipped",
];

const limitOptions = [25, 50, 100];

export function AiOpsDashboard() {
  const [summary, setSummary] = useState<AdminAiOpsSummary | null>(null);
  const [runs, setRuns] = useState<AdminAiOpsRunSummary[]>([]);
  const [draftFilters, setDraftFilters] = useState<AiOpsFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<AiOpsFilters>(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadAiOps() {
      setIsLoading(true);
      setErrorMessage(null);

      const runFilters: AdminAiOpsRunsParams = {
        feature: appliedFilters.feature,
        limit: appliedFilters.limit,
        sort: appliedFilters.sort,
        ...(appliedFilters.q.trim() ? { q: appliedFilters.q.trim() } : {}),
        ...(appliedFilters.status !== "all" ? { status: appliedFilters.status } : {}),
      };

      const [summaryResponse, runsResponse] = await Promise.all([
        getAdminAiOpsSummary(),
        listAdminAiOpsRuns(runFilters),
      ]);

      if (!isActive) {
        return;
      }

      if (!summaryResponse.ok) {
        setSummary(null);
        setRuns([]);
        setErrorMessage(getApiErrorMessage(summaryResponse, "AI operasyon özeti yüklenemedi."));
        setIsLoading(false);
        return;
      }

      if (!runsResponse.ok) {
        setSummary(summaryResponse.data.summary);
        setRuns([]);
        setErrorMessage(getApiErrorMessage(runsResponse, "AI çalıştırmaları yüklenemedi."));
        setIsLoading(false);
        return;
      }

      setSummary(summaryResponse.data.summary);
      setRuns(runsResponse.data.runs);
      setIsLoading(false);
    }

    void loadAiOps();

    return () => {
      isActive = false;
    };
  }, [appliedFilters]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({
      ...draftFilters,
      q: draftFilters.q.trim(),
    });
  }

  function resetFilters() {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  }

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">AI Operasyonları</p>
          <h2>AI çalışma sağlığı</h2>
          <p>
            Provider/model kullanımını, hataları ve son güvenli AI çalıştırmalarını raw prompt,
            raw çıktı, görsel payload, mesaj gövdesi, raporlayan kimliği, email veya telefon göstermeden izle.
          </p>
        </div>
        <Link className="secondary-action" href="/moderation">
          Moderasyona git
        </Link>
      </div>

      {isLoading ? <div className="state-panel">AI operasyon verisi yükleniyor...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="AI operasyon özeti">
            <SummaryCard label="Çalıştırma 24s" value={summary.totals.runsLast24Hours} />
            <SummaryCard label="Çalıştırma 7g" value={summary.totals.runsLast7Days} />
            <SummaryCard label="Başarılı 7g" value={summary.totals.successRunsLast7Days} />
            <SummaryCard label="Hata 7g" value={summary.totals.failedRunsLast7Days} />
            <SummaryCard label="Provider hatası" value={summary.totals.providerFailuresLast7Days} />
            <SummaryCard label="Validation hatası" value={summary.totals.validationFailuresLast7Days} />
            <SummaryCard label="Atlanan 7g" value={summary.totals.skippedRunsLast7Days} />
            <SummaryCard label="Toplam çalışma" value={summary.totals.totalRuns} />
          </section>

          <section className="module-grid" aria-label="AI operasyon kırılımları">
            <article className="module-card dashboard-module-card">
              <h3>Durum kırılımı</h3>
              <p>Tüm zamanlarda duruma göre çalışma sayısı.</p>
              <dl className="compact-details">
                {summary.statusCounts.map((item) => (
                  <div key={item.status}>
                    <dt>{formatStatus(item.status)}</dt>
                    <dd>{item.count}</dd>
                  </div>
                ))}
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Provider / model kırılımı</h3>
              <p>Çalıştırma sayısına göre provider ve model kombinasyonları.</p>
              <div className="table-list">
                {summary.providerModelCounts.length === 0 ? (
                  <div className="state-panel">Henüz AI model çalıştırması yok.</div>
                ) : (
                  summary.providerModelCounts.map((item) => (
                    <div
                      className="table-list-row"
                      key={`${item.providerName}-${item.modelName ?? "unknown"}`}
                    >
                      <div>
                        <strong>{item.providerName}</strong>
                        <p className="muted">{item.modelName ?? "Bilinmeyen model"}</p>
                      </div>
                      <small className="muted">
                        toplam {item.totalRuns} · başarılı {item.successRuns} · hatalı {item.failedRuns}
                      </small>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}

      <form className="filter-panel" onSubmit={handleSubmit}>
        <div className="filter-grid">
            <label className="form-field">
              <span>Özellik</span>
              <select
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    feature: event.target.value as AdminAiOpsFeature,
                  }))
                }
                value={draftFilters.feature}
              >
                {featureOptions.map((feature) => (
                  <option key={feature} value={feature}>
                    {formatFeature(feature)}
                  </option>
                ))}
              </select>
            </label>

          <label className="form-field">
            <span>Arama</span>
            <input
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Run id, case id, listing id, provider, model veya prompt version"
              type="search"
              value={draftFilters.q}
            />
          </label>

          <label className="form-field">
            <span>Durum</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: event.target.value as AiOpsFilters["status"],
                }))
              }
              value={draftFilters.status}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "Tüm durumlar" : formatStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Sıralama</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  sort: event.target.value as AiOpsFilters["sort"],
                }))
              }
              value={draftFilters.sort}
            >
              <option value="newest">En yeni</option>
              <option value="oldest">En eski</option>
            </select>
          </label>

          <label className="form-field">
            <span>Limit</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  limit: Number(event.target.value),
                }))
              }
              value={draftFilters.limit}
            >
              {limitOptions.map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-actions">
          <button className="primary-action" disabled={isLoading} type="submit">
            Filtrele
          </button>
          <button
            className="secondary-action"
            disabled={isLoading}
            onClick={resetFilters}
            type="button"
          >
            Sıfırla
          </button>
        </div>
      </form>

      <section className="profile-detail-card wide">
        <h3>Son güvenli AI çalıştırmaları</h3>
        {runs.length === 0 && !isLoading ? (
          <div className="state-panel">Bu filtrelerle eşleşen AI çalıştırması yok.</div>
        ) : null}
        {runs.length > 0 ? (
          <div className="table-list">
            {runs.map((run) => (
              <div className="table-list-row" key={run.id}>
                <div>
                  <strong>{run.providerName}</strong>
                  <p className="muted">
                    {run.modelName ?? "Bilinmeyen model"} · {run.promptVersion}
                  </p>
                  <p className="muted">
                    Çalıştırma {run.id} · {formatDate(run.createdAt)}
                  </p>
                  {run.caseId ? (
                    <Link href={`/moderation/${run.caseId}`}>İlgili vakaya git</Link>
                  ) : null}
                  {run.errorSummary ? <p>{run.errorSummary}</p> : null}
                </div>
                <div className="side-stack">
                  <span className={`status-badge ${run.status}`}>{formatStatus(run.status)}</span>
                  <small className="muted">
                    güven {formatScore(run.confidenceScore)} · risk {formatScore(run.riskScore)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
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

function getApiErrorMessage(response: ApiResponse<unknown>, fallback: string): string {
  return response.ok ? fallback : response.error.message || fallback;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("tr-TR");
}

function formatScore(value: number | null): string {
  return value === null ? "yok" : String(value);
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    error: "Hata",
    provider_failed: "Provider hatası",
    skipped: "Atlandı",
    success: "Başarılı",
    validation_failed: "Validation hatası"
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function formatFeature(feature: AdminAiOpsFeature): string {
  switch (feature) {
    case "moderation_summary":
      return "Moderasyon özeti";
    case "listing_image_authenticity":
      return "İlan görsel gerçekliği";
  }
}

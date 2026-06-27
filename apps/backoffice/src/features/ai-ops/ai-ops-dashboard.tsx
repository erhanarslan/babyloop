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
        setErrorMessage(getApiErrorMessage(summaryResponse, "Could not load AI ops summary."));
        setIsLoading(false);
        return;
      }

      if (!runsResponse.ok) {
        setSummary(summaryResponse.data.summary);
        setRuns([]);
        setErrorMessage(getApiErrorMessage(runsResponse, "Could not load AI runs."));
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
          <p className="eyebrow">AI Operations</p>
          <h2>AI operations health</h2>
          <p>
            Monitor provider/model usage, failures, and recent safe AI runs without
            exposing raw prompts, raw outputs, image payloads, message bodies, reporter identity, email, or phone data.
          </p>
        </div>
        <Link className="secondary-action" href="/moderation">
          Open moderation
        </Link>
      </div>

      {isLoading ? <div className="state-panel">Loading AI ops...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="AI ops summary">
            <SummaryCard label="Runs 24h" value={summary.totals.runsLast24Hours} />
            <SummaryCard label="Runs 7d" value={summary.totals.runsLast7Days} />
            <SummaryCard label="Success 7d" value={summary.totals.successRunsLast7Days} />
            <SummaryCard label="Failures 7d" value={summary.totals.failedRunsLast7Days} />
            <SummaryCard label="Provider failures" value={summary.totals.providerFailuresLast7Days} />
            <SummaryCard label="Validation failures" value={summary.totals.validationFailuresLast7Days} />
            <SummaryCard label="Skipped 7d" value={summary.totals.skippedRunsLast7Days} />
            <SummaryCard label="All runs" value={summary.totals.totalRuns} />
          </section>

          <section className="module-grid" aria-label="AI ops breakdowns">
            <article className="module-card dashboard-module-card">
              <h3>Status breakdown</h3>
              <p>All-time run count by status.</p>
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
              <h3>Provider / model breakdown</h3>
              <p>Top provider and model combinations by run count.</p>
              <div className="table-list">
                {summary.providerModelCounts.length === 0 ? (
                  <div className="state-panel">No AI model runs recorded yet.</div>
                ) : (
                  summary.providerModelCounts.map((item) => (
                    <div
                      className="table-list-row"
                      key={`${item.providerName}-${item.modelName ?? "unknown"}`}
                    >
                      <div>
                        <strong>{item.providerName}</strong>
                        <p className="muted">{item.modelName ?? "Unknown model"}</p>
                      </div>
                      <small className="muted">
                        total {item.totalRuns} · success {item.successRuns} · failed {item.failedRuns}
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
              <span>Feature</span>
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
            <span>Search</span>
            <input
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Run id, case id, listing id, provider, model, or prompt version"
              type="search"
              value={draftFilters.q}
            />
          </label>

          <label className="form-field">
            <span>Status</span>
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
                  {status === "all" ? "All statuses" : formatStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Sort</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  sort: event.target.value as AiOpsFilters["sort"],
                }))
              }
              value={draftFilters.sort}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
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
            Apply filters
          </button>
          <button
            className="secondary-action"
            disabled={isLoading}
            onClick={resetFilters}
            type="button"
          >
            Reset
          </button>
        </div>
      </form>

      <section className="profile-detail-card wide">
        <h3>Recent safe AI runs</h3>
        {runs.length === 0 && !isLoading ? (
          <div className="state-panel">No AI runs match these filters.</div>
        ) : null}
        {runs.length > 0 ? (
          <div className="table-list">
            {runs.map((run) => (
              <div className="table-list-row" key={run.id}>
                <div>
                  <strong>{run.providerName}</strong>
                  <p className="muted">
                    {run.modelName ?? "Unknown model"} · {run.promptVersion}
                  </p>
                  <p className="muted">
                    Run {run.id} · {formatDate(run.createdAt)}
                  </p>
                  {run.caseId ? (
                    <Link href={`/moderation/${run.caseId}`}>Open related case</Link>
                  ) : null}
                  {run.errorSummary ? <p>{run.errorSummary}</p> : null}
                </div>
                <div className="side-stack">
                  <span className={`status-badge ${run.status}`}>{formatStatus(run.status)}</span>
                  <small className="muted">
                    confidence {formatScore(run.confidenceScore)} · risk {formatScore(run.riskScore)}
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
  return new Date(value).toLocaleString();
}

function formatScore(value: number | null): string {
  return value === null ? "n/a" : String(value);
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function formatFeature(feature: AdminAiOpsFeature): string {
  switch (feature) {
    case "moderation_summary":
      return "Moderation summary";
    case "listing_image_authenticity":
      return "Listing image authenticity";
  }
}

"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminModerationCase,
  type AdminModerationCasesSummary,
  type AdminModerationCaseStatus,
  type AdminModerationSort,
  type AdminModerationTargetType,
  listAdminModerationCases,
} from "./api";

type StatusFilter = AdminModerationCaseStatus | "all";
type TargetTypeFilter = AdminModerationTargetType | "all";

type FilterState = {
  status: StatusFilter;
  targetType: TargetTypeFilter;
  q: string;
  sort: AdminModerationSort;
  limit: number;
};

const statusFilters: StatusFilter[] = [
  "all",
  "pending",
  "in_review",
  "resolved",
  "dismissed",
];

const targetTypeFilters: TargetTypeFilter[] = ["all", "listing", "profile", "message"];
const sortOptions: AdminModerationSort[] = [
  "newest",
  "oldest",
  "updated_desc",
  "updated_asc",
];
const limitOptions = [25, 50, 100];

const defaultFilters: FilterState = {
  status: "all",
  targetType: "all",
  q: "",
  sort: "newest",
  limit: 50,
};

const emptySummary: AdminModerationCasesSummary = {
  total: 0,
  byStatus: {
    pending: 0,
    inReview: 0,
    resolved: 0,
    dismissed: 0,
  },
  byTargetType: {
    listing: 0,
    profile: 0,
    message: 0,
  },
};

export function ModerationCaseList() {
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);
  const [cases, setCases] = useState<AdminModerationCase[]>([]);
  const [summary, setSummary] =
    useState<AdminModerationCasesSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCases() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await listAdminModerationCases({
        ...(appliedFilters.status === "all"
          ? {}
          : { status: appliedFilters.status }),
        ...(appliedFilters.targetType === "all"
          ? {}
          : { targetType: appliedFilters.targetType }),
        ...(appliedFilters.q.trim() ? { q: appliedFilters.q.trim() } : {}),
        sort: appliedFilters.sort,
        limit: appliedFilters.limit,
      });

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setCases([]);
        setSummary(emptySummary);
        setErrorMessage(getApiErrorMessage(response, "Could not load cases."));
        setIsLoading(false);
        return;
      }

      setCases(response.data.cases);
      setSummary(response.data.summary);
      setIsLoading(false);
    }

    void loadCases();

    return () => {
      isActive = false;
    };
  }, [appliedFilters]);

  function applyFilters() {
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
          <p className="eyebrow">Moderation</p>
          <h2>Moderation cases</h2>
          <p>
            Review reported listings, messages, and profiles from the dedicated
            backoffice application.
          </p>
        </div>
      </div>

      <div className="summary-grid" aria-label="Moderation triage summary">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Pending" value={summary.byStatus.pending} />
        <SummaryCard label="In review" value={summary.byStatus.inReview} />
        <SummaryCard label="Messages" value={summary.byTargetType.message} />
        <SummaryCard label="Listings" value={summary.byTargetType.listing} />
      </div>

      <form
        className="filter-panel"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <div className="filter-grid">
          <label className="form-field">
            <span>Status</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: event.target.value as StatusFilter,
                }))
              }
              value={draftFilters.status}
            >
              {statusFilters.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Target type</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  targetType: event.target.value as TargetTypeFilter,
                }))
              }
              value={draftFilters.targetType}
            >
              {targetTypeFilters.map((targetType) => (
                <option key={targetType} value={targetType}>
                  {getTargetTypeLabel(targetType)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Search</span>
            <input
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
              placeholder="Case, report, target, status"
              type="search"
              value={draftFilters.q}
            />
          </label>

          <label className="form-field">
            <span>Sort</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  sort: event.target.value as AdminModerationSort,
                }))
              }
              value={draftFilters.sort}
            >
              {sortOptions.map((sort) => (
                <option key={sort} value={sort}>
                  {getSortLabel(sort)}
                </option>
              ))}
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

      {isLoading ? (
        <div className="state-panel">Loading moderation cases...</div>
      ) : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && cases.length === 0 ? (
        <div className="state-panel">
          <strong>No cases found</strong>
          <p>There are no moderation cases matching this filter.</p>
        </div>
      ) : null}

      {!isLoading && !errorMessage && cases.length > 0 ? (
        <div className="case-list">
          {cases.map((moderationCase) => (
            <article className="case-card" key={moderationCase.id}>
              <div>
                <div className="case-card-header">
                  <span className={`status-badge ${moderationCase.status}`}>
                    {getStatusLabel(moderationCase.status)}
                  </span>
                  <span className="muted">{moderationCase.subjectType}</span>
                </div>

                <h3>Case {shortId(moderationCase.id)}</h3>
                <p>{moderationCase.reason}</p>

                {moderationCase.details ? (
                  <p className="muted">{moderationCase.details}</p>
                ) : null}

                <dl className="compact-details">
                  <div>
                    <dt>Subject ID</dt>
                    <dd>{moderationCase.subjectId}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateTime(moderationCase.createdAt)}</dd>
                  </div>
                </dl>
              </div>

              <Link className="secondary-action" href={`/moderation/${moderationCase.id}`}>
                Open case
              </Link>
            </article>
          ))}
        </div>
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

function getStatusLabel(status: StatusFilter): string {
  switch (status) {
    case "all":
      return "All";
    case "pending":
      return "Pending";
    case "in_review":
      return "In review";
    case "resolved":
      return "Resolved";
    case "dismissed":
      return "Dismissed";
  }
}

function getTargetTypeLabel(targetType: TargetTypeFilter): string {
  switch (targetType) {
    case "all":
      return "All";
    case "listing":
      return "Listing";
    case "profile":
      return "Profile";
    case "message":
      return "Message";
  }
}

function getSortLabel(sort: AdminModerationSort): string {
  switch (sort) {
    case "newest":
      return "Newest";
    case "oldest":
      return "Oldest";
    case "updated_desc":
      return "Recently updated";
    case "updated_asc":
      return "Least recently updated";
  }
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
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

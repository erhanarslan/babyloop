"use client";

import type { ApiResponse } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  type AdminProfileRiskLevel,
  type AdminProfileSafetyStatus,
  type AdminProfileSort,
  type AdminProfileSummary,
  listAdminProfiles,
} from "./api";

type SafetyStatusFilter = "" | AdminProfileSafetyStatus;
type RiskLevelFilter = "" | AdminProfileRiskLevel;

type ProfileFilters = {
  safetyStatus: SafetyStatusFilter;
  riskLevel: RiskLevelFilter;
  q: string;
  sort: AdminProfileSort;
  limit: number;
};

const defaultFilters: ProfileFilters = {
  safetyStatus: "",
  riskLevel: "",
  q: "",
  sort: "risk_desc",
  limit: 50,
};

const safetyStatuses: SafetyStatusFilter[] = ["", "active", "restricted", "suspended"];
const riskLevels: RiskLevelFilter[] = ["", "low", "medium", "high", "critical"];
const sortOptions: AdminProfileSort[] = [
  "risk_desc",
  "risk_asc",
  "trust_desc",
  "trust_asc",
  "newest",
  "oldest",
];
const limitOptions = [25, 50, 100];

export function ProfileAdminList() {
  const [draftFilters, setDraftFilters] = useState<ProfileFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ProfileFilters>(defaultFilters);
  const [profiles, setProfiles] = useState<AdminProfileSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadProfiles() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await listAdminProfiles({
        ...(appliedFilters.safetyStatus
          ? { safetyStatus: appliedFilters.safetyStatus }
          : {}),
        ...(appliedFilters.riskLevel ? { riskLevel: appliedFilters.riskLevel } : {}),
        ...(appliedFilters.q.trim() ? { q: appliedFilters.q.trim() } : {}),
        sort: appliedFilters.sort,
        limit: appliedFilters.limit,
      });

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setProfiles([]);
        setErrorMessage(getApiErrorMessage(response, "Could not load profiles."));
        setIsLoading(false);
        return;
      }

      setProfiles(response.data.profiles);
      setIsLoading(false);
    }

    void loadProfiles();

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
          <p className="eyebrow">Trust & Safety</p>
          <h2>Profiles</h2>
          <p>
            Search profiles by safety status and trust-risk signals. This directory
            intentionally excludes email, phone, raw user records, and raw report content.
          </p>
        </div>
      </div>

      <form className="filter-panel" onSubmit={handleSubmit}>
        <div className="filter-grid">
          <label className="form-field">
            <span>Safety status</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  safetyStatus: event.target.value as SafetyStatusFilter,
                }))
              }
              value={draftFilters.safetyStatus}
            >
              {safetyStatuses.map((status) => (
                <option key={status || "all"} value={status}>
                  {status ? formatStatus(status) : "All statuses"}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Risk level</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  riskLevel: event.target.value as RiskLevelFilter,
                }))
              }
              value={draftFilters.riskLevel}
            >
              {riskLevels.map((level) => (
                <option key={level || "all"} value={level}>
                  {level ? formatStatus(level) : "All risk levels"}
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
              placeholder="Profile display name, city, or profile id"
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
                  sort: event.target.value as AdminProfileSort,
                }))
              }
              value={draftFilters.sort}
            >
              {sortOptions.map((sort) => (
                <option key={sort} value={sort}>
                  {formatSort(sort)}
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

      {isLoading ? <div className="state-panel">Loading profiles...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && profiles.length === 0 ? (
        <div className="state-panel">No profiles match these filters.</div>
      ) : null}

      {profiles.length > 0 ? (
        <div className="profile-admin-grid" aria-label="Profiles">
          {profiles.map((profile) => (
            <ProfileCard key={profile.profileId} profile={profile} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ProfileCard({ profile }: { profile: AdminProfileSummary }) {
  const snapshot = profile.trustSnapshot;
  const riskLevel = snapshot?.riskLevel ?? "low";

  return (
    <article className="profile-admin-card">
      <div className="profile-admin-card-header">
        <div>
          <strong>{profile.displayName}</strong>
          <p>{profile.locationCity ?? "Location not provided"}</p>
        </div>
        <span className={`risk-pill ${riskLevel}`}>{formatStatus(riskLevel)}</span>
      </div>

      <dl className="compact-details">
        <div>
          <dt>Profile ID</dt>
          <dd>{profile.profileId.slice(0, 8)}</dd>
        </div>
        <div>
          <dt>Safety status</dt>
          <dd>{formatStatus(profile.safetyStatus)}</dd>
        </div>
        <div>
          <dt>Listings</dt>
          <dd>{profile.listingCount}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(profile.createdAt)}</dd>
        </div>
      </dl>

      {snapshot ? (
        <div className="profile-snapshot-summary">
          <dl className="compact-details">
            <div>
              <dt>Trust score</dt>
              <dd>{snapshot.trustScore}</dd>
            </div>
            <div>
              <dt>Risk score</dt>
              <dd>{snapshot.riskScore}</dd>
            </div>
            <div>
              <dt>Open cases</dt>
              <dd>{snapshot.openCaseCount}</dd>
            </div>
            <div>
              <dt>Recent reports</dt>
              <dd>{snapshot.recentReportCount}</dd>
            </div>
            <div>
              <dt>Enforcement 30d</dt>
              <dd>{snapshot.recentEnforcementCount}</dd>
            </div>
            <div>
              <dt>AI summaries</dt>
              <dd>{snapshot.aiSummaryCount}</dd>
            </div>
          </dl>
          <p className="muted">Computed {formatDateTime(snapshot.computedAt)}</p>
        </div>
      ) : (
        <p className="muted">No trust snapshot has been computed for this profile yet.</p>
      )}
    </article>
  );
}

function formatStatus(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatSort(sort: AdminProfileSort): string {
  switch (sort) {
    case "risk_desc":
      return "Highest risk first";
    case "risk_asc":
      return "Lowest risk first";
    case "trust_desc":
      return "Highest trust first";
    case "trust_asc":
      return "Lowest trust first";
    case "newest":
      return "Newest profiles";
    case "oldest":
      return "Oldest profiles";
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  return response.ok ? fallback : response.error.message;
}

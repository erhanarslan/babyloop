"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  type AdminProfileRiskLevel,
  type AdminProfileSafetyStatus,
  type AdminProfileSort,
  type AdminProfileResponseSummary,
  listAdminProfiles,
} from "./api";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

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
  const [profiles, setProfiles] = useState<AdminProfileResponseSummary[]>([]);
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
        setErrorMessage(getApiErrorMessage(response, "Profiller yüklenemedi."));
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
          <p className="eyebrow">Güven ve Emniyet</p>
          <h2>Profiller</h2>
          <p>
            Profilleri güvenlik durumu ve güven-risk sinyalleriyle ara. Bu dizinde e-posta,
            telefon, ham kullanıcı kaydı veya ham şikâyet içeriği gösterilmez.
          </p>
        </div>
      </div>

      <form className="filter-panel" onSubmit={handleSubmit}>
        <div className="filter-grid">
          <label className="form-field">
            <span>Güvenlik durumu</span>
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
                  {status ? formatEnumLabel(status) : "Tüm durumlar"}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Risk düzeyi</span>
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
                  {level ? formatEnumLabel(level) : "Tüm risk düzeyleri"}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Arama</span>
            <input
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
              placeholder="Görünen ad, şehir veya profil kimliği"
              type="search"
              value={draftFilters.q}
            />
          </label>

          <label className="form-field">
            <span>Sıralama</span>
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
            <span>Sayfa boyutu</span>
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
            Filtreleri uygula
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

      {isLoading ? <div className="state-panel">Profiller yükleniyor…</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && profiles.length === 0 ? (
        <div className="state-panel">Bu filtrelerle eşleşen profil yok.</div>
      ) : null}

      {profiles.length > 0 ? (
        <div className="profile-admin-grid" aria-label="Profiller">
          {profiles.map((profile) => (
            <ProfileCard key={profile.profileId} profile={profile} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ProfileCard({ profile }: { profile: AdminProfileResponseSummary }) {
  const fullProfile = "trustSnapshot" in profile ? profile : null;
  const snapshot = fullProfile?.trustSnapshot ?? null;
  const riskLevel = snapshot?.riskLevel ?? "low";

  return (
    <article className="profile-admin-card">
      <div className="profile-admin-card-header">
        <div>
          <strong>{profile.displayName}</strong>
          <p>{profile.locationCity ?? "Konum belirtilmedi"}</p>
        </div>
        {fullProfile ? (
          <span className={`risk-pill ${riskLevel}`}>{formatEnumLabel(riskLevel)}</span>
        ) : null}
      </div>

      <dl className="compact-details">
        <div>
          <dt>Profil kimliği</dt>
          <dd>{profile.profileId.slice(0, 8)}</dd>
        </div>
        {fullProfile ? (
          <div>
            <dt>Güvenlik durumu</dt>
            <dd>{formatEnumLabel(fullProfile.safetyStatus)}</dd>
          </div>
        ) : null}
        <div>
          <dt>İlanlar</dt>
          <dd>{profile.listingCount}</dd>
        </div>
        <div>
          <dt>Oluşturulma</dt>
          <dd>{formatDateTime(profile.createdAt)}</dd>
        </div>
      </dl>

      {snapshot ? (
        <div className="profile-snapshot-summary">
          <dl className="compact-details">
            <div>
              <dt>Güven puanı</dt>
              <dd>{snapshot.trustScore}</dd>
            </div>
            <div>
              <dt>Risk puanı</dt>
              <dd>{snapshot.riskScore}</dd>
            </div>
            <div>
              <dt>Açık vakalar</dt>
              <dd>{snapshot.openCaseCount}</dd>
            </div>
            <div>
              <dt>Yakın tarihli şikâyetler</dt>
              <dd>{snapshot.recentReportCount}</dd>
            </div>
            <div>
              <dt>30 günlük yaptırım</dt>
              <dd>{snapshot.recentEnforcementCount}</dd>
            </div>
            <div>
              <dt>AI özetleri</dt>
              <dd>{snapshot.aiSummaryCount}</dd>
            </div>
          </dl>
          <p className="muted">Hesaplanma: {formatDateTime(snapshot.computedAt)}</p>
        </div>
      ) : (
        <p className="muted">Bu profil için henüz güven görünümü hesaplanmadı.</p>
      )}

      <Link className="secondary-action profile-detail-link" href={`/profiles/${profile.profileId}`}>
        Profil ayrıntısını görüntüle
      </Link>
    </article>
  );
}

function formatSort(sort: AdminProfileSort): string {
  switch (sort) {
    case "risk_desc":
      return "Önce en yüksek risk";
    case "risk_asc":
      return "Önce en düşük risk";
    case "trust_desc":
      return "Önce en yüksek güven";
    case "trust_asc":
      return "Önce en düşük güven";
    case "newest":
      return "En yeni profiller";
    case "oldest":
      return "En eski profiller";
  }
}

function formatDateTime(value: string): string {
  return formatDateTimeTr(value);
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  return response.ok || response.error.code !== "FORBIDDEN"
    ? fallback
    : "Profilleri görüntüleme yetkin yok.";
}

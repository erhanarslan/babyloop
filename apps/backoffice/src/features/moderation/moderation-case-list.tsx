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
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

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
        setErrorMessage(getApiErrorMessage(response, "Moderasyon vakaları yüklenemedi."));
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
          <p className="eyebrow">Moderasyon</p>
          <h2>Moderasyon vakaları</h2>
          <p>
            Şikâyet edilen ilanları, mesajları ve profilleri yönetim panelinden incele.
          </p>
        </div>
      </div>

      <div className="summary-grid" aria-label="Moderasyon öncelik özeti">
        <SummaryCard label="Toplam" value={summary.total} />
        <SummaryCard label="Bekliyor" value={summary.byStatus.pending} />
        <SummaryCard label="İncelemede" value={summary.byStatus.inReview} />
        <SummaryCard label="Mesajlar" value={summary.byTargetType.message} />
        <SummaryCard label="İlanlar" value={summary.byTargetType.listing} />
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
            <span>Durum</span>
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
            <span>Hedef türü</span>
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
            <span>Arama</span>
            <input
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
              placeholder="Vaka, şikâyet, hedef veya durum"
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

      {isLoading ? (
        <div className="state-panel">Moderasyon vakaları yükleniyor…</div>
      ) : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && cases.length === 0 ? (
        <div className="state-panel">
          <strong>Vaka bulunamadı</strong>
          <p>Bu filtreyle eşleşen moderasyon vakası yok.</p>
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
                  <span className="muted">{formatEnumLabel(moderationCase.subjectType)}</span>
                </div>

                <h3>Vaka {shortId(moderationCase.id)}</h3>
                <p>{formatEnumLabel(moderationCase.reason)}</p>

                {moderationCase.details ? (
                  <p className="muted">{moderationCase.details}</p>
                ) : null}

                <dl className="compact-details">
                  <div>
                    <dt>Hedef kimliği</dt>
                    <dd>{moderationCase.subjectId}</dd>
                  </div>
                  <div>
                    <dt>Oluşturulma</dt>
                    <dd>{formatDateTime(moderationCase.createdAt)}</dd>
                  </div>
                </dl>
              </div>

              <Link className="secondary-action" href={`/moderation/${moderationCase.id}`}>
                Vakayı aç
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
      return "Tümü";
    case "pending":
      return "Bekliyor";
    case "in_review":
      return "İncelemede";
    case "resolved":
      return "Çözüldü";
    case "dismissed":
      return "Kapatıldı";
  }
}

function getTargetTypeLabel(targetType: TargetTypeFilter): string {
  switch (targetType) {
    case "all":
      return "Tümü";
    case "listing":
      return "İlan";
    case "profile":
      return "Profil";
    case "message":
      return "Mesaj";
  }
}

function getSortLabel(sort: AdminModerationSort): string {
  switch (sort) {
    case "newest":
      return "En yeni";
    case "oldest":
      return "En eski";
    case "updated_desc":
      return "Son güncellenen";
    case "updated_asc":
      return "En eski güncellenen";
  }
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function formatDateTime(value: string): string {
  return formatDateTimeTr(value);
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.code === "FORBIDDEN"
    ? "Moderasyon vakalarını görüntüleme yetkin yok."
    : fallback;
}

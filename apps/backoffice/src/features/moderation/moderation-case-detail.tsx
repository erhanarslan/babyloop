"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminModerationCaseDetail as AdminModerationCaseDetailType,
  type AdminModerationCaseStatus,
  type AdminModerationTimelineItem,
  getAdminModerationCase,
} from "./api";
import { AiSummaryPanel } from "./ai-summary-panel";
import { CaseInsightsPanel } from "./case-insights-panel";
import { EnforcementActionPanel } from "./enforcement-action-panel";
import { ModerationActionForm } from "./moderation-action-form";
import { ModerationStatusForm } from "./moderation-status-form";
import { SensitiveAccessPanel } from "./sensitive-access-panel";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

type ModerationCaseDetailProps = {
  caseId: string;
};

type TimelineFilter = "all" | "actions" | "notes" | "sensitive" | "status";

const timelineFilters: TimelineFilter[] = [
  "all",
  "actions",
  "notes",
  "sensitive",
  "status",
];

export function ModerationCaseDetail({ caseId }: ModerationCaseDetailProps) {
  const [moderationCase, setModerationCase] =
    useState<AdminModerationCaseDetailType | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCase() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminModerationCase(caseId);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setModerationCase(null);
        setErrorMessage(getApiErrorMessage(response, "Moderasyon vakası yüklenemedi."));
        setIsLoading(false);
        return;
      }

      setModerationCase(response.data.case);
      setIsLoading(false);
    }

    void loadCase();

    return () => {
      isActive = false;
    };
  }, [caseId]);

  if (isLoading) {
    return <div className="state-panel">Moderasyon vakası yükleniyor…</div>;
  }

  if (errorMessage) {
    return (
      <div className="state-panel danger" role="alert">
        {errorMessage}
      </div>
    );
  }

  if (!moderationCase) {
    return (
      <div className="state-panel">
        <strong>Vaka bulunamadı</strong>
      </div>
    );
  }

  const visibleTimeline = moderationCase.timeline.filter((item) =>
    timelineItemMatchesFilter(item, timelineFilter),
  );

  return (
    <div className="detail-layout">
      <section className="content-card">
        <Link className="secondary-action" href="/moderation">
          Vakalara dön
        </Link>

        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Moderasyon vakası</p>
            <h2>Vaka {shortId(moderationCase.id)}</h2>
            <p>{formatEnumLabel(moderationCase.reason)}</p>
          </div>

          <span className={`status-badge ${moderationCase.status}`}>
            {getStatusLabel(moderationCase.status)}
          </span>
        </div>

        <dl className="details-grid">
          <div>
            <dt>Vaka kimliği</dt>
            <dd>{moderationCase.id}</dd>
          </div>
          <div>
            <dt>Durum</dt>
            <dd>{getStatusLabel(moderationCase.status)}</dd>
          </div>
          <div>
            <dt>Hedef türü</dt>
            <dd>{formatEnumLabel(moderationCase.subjectType)}</dd>
          </div>
          <div>
            <dt>Hedef kimliği</dt>
            <dd>{moderationCase.subjectId}</dd>
          </div>
          <div>
            <dt>Oluşturulma</dt>
            <dd>{formatDateTime(moderationCase.createdAt)}</dd>
          </div>
          <div>
            <dt>Güncellenme</dt>
            <dd>{formatDateTime(moderationCase.updatedAt)}</dd>
          </div>
        </dl>

        <section className="note-panel">
          <h3>Ayrıntılar</h3>
          <p>{moderationCase.details || "Ayrıntı belirtilmedi."}</p>
        </section>
      </section>

      <section className="side-stack">
        <ModerationStatusForm
          moderationCase={moderationCase}
          onUpdated={setModerationCase}
        />

        <ModerationActionForm
          moderationCase={moderationCase}
          onCreated={setModerationCase}
        />

        <CaseInsightsPanel moderationCase={moderationCase} />

        <EnforcementActionPanel
          moderationCase={moderationCase}
          onApplied={setModerationCase}
        />

        <AiSummaryPanel moderationCase={moderationCase} />

        <SensitiveAccessPanel moderationCase={moderationCase} />
      </section>

      <section className="content-card full-span">
        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Denetim zaman çizelgesi</p>
            <h2>Vaka zaman çizelgesi</h2>
            <p>
              Bu vakanın hassas alanları çıkarılmış moderasyon geçmişi, işlemleri
              ve hassas erişim denetim olayları gösterilir.
            </p>
          </div>
        </div>

        <div className="filter-row" aria-label="Zaman çizelgesi filtreleri">
          {timelineFilters.map((filter) => (
            <button
              className={timelineFilter === filter ? "filter-pill active" : "filter-pill"}
              key={filter}
              onClick={() => setTimelineFilter(filter)}
              type="button"
            >
              {getTimelineFilterLabel(filter)}
            </button>
          ))}
        </div>

        {visibleTimeline.length === 0 ? (
          <div className="state-panel">
            Bu filtreyle eşleşen zaman çizelgesi olayı yok.
          </div>
        ) : (
          <div className="timeline">
            {visibleTimeline.map((item) => (
              <article className={`timeline-item ${item.type}`} key={item.id}>
                <div>
                  <strong>{formatTimelineLabel(item.label)}</strong>
                  {item.note ? <p>{item.note}</p> : null}
                </div>

                <dl className="compact-details">
                  <div>
                    <dt>İşlemi yapan</dt>
                    <dd>{getTimelineActorLabel(item)}</dd>
                  </div>
                  <div>
                    <dt>Oluşturulma</dt>
                    <dd>{formatDateTime(item.createdAt)}</dd>
                  </div>
                </dl>

                {item.metadata ? (
                  <div className="metadata-chip-row">
                    {Object.entries(item.metadata).map(([key, value]) => (
                      <span className="metadata-chip" key={`${item.id}:${key}`}>
                        <strong>{formatMetadataKey(key)}</strong>
                        {formatMetadataValue(value)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function timelineItemMatchesFilter(
  item: AdminModerationTimelineItem,
  filter: TimelineFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "actions":
      return item.type === "moderation_action" || item.type === "audit_event";
    case "notes":
      return item.type === "note";
    case "sensitive":
      return (
        item.type === "sensitive_access_granted" ||
        item.type === "sensitive_access_denied"
      );
    case "status":
      return item.type === "status_change";
  }
}

function getTimelineFilterLabel(filter: TimelineFilter): string {
  switch (filter) {
    case "all":
      return "Tümü";
    case "actions":
      return "İşlemler";
    case "notes":
      return "Notlar";
    case "sensitive":
      return "Hassas erişim";
    case "status":
      return "Durum";
  }
}

function formatTimelineLabel(label: string): string {
  const labels: Record<string, string> = {
    "Case created": "Vaka oluşturuldu",
    "Report received": "Şikâyet alındı"
  };
  return labels[label] ?? label;
}

function getTimelineActorLabel(item: AdminModerationTimelineItem): string {
  if (!item.actor) {
    return "Sistem";
  }

  return item.actor.displayName ?? item.actor.id;
}

function formatMetadataKey(key: string): string {
  const labels: Record<string, string> = {
    action: "İşlem",
    nextStatus: "Sonraki durum",
    previousStatus: "Önceki durum",
    reason: "Neden",
    reportId: "Şikâyet kimliği",
    targetId: "Hedef kimliği",
    targetType: "Hedef türü"
  };
  return labels[key] ?? key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatMetadataValue(
  value: string | number | boolean | string[] | null,
): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Yok";
  }

  if (value === null) {
    return "Yok";
  }

  return typeof value === "string" ? formatEnumLabel(value) : String(value);
}

function getStatusLabel(status: AdminModerationCaseStatus): string {
  return formatEnumLabel(status);
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
    ? "Bu moderasyon vakasını görüntüleme yetkin yok."
    : fallback;
}

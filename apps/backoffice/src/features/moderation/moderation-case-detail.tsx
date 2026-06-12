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
        setErrorMessage(getApiErrorMessage(response, "Could not load case."));
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
    return <div className="state-panel">Loading moderation case...</div>;
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
        <strong>Case not found</strong>
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
          Back to cases
        </Link>

        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Moderation case</p>
            <h2>Case {shortId(moderationCase.id)}</h2>
            <p>{moderationCase.reason}</p>
          </div>

          <span className={`status-badge ${moderationCase.status}`}>
            {getStatusLabel(moderationCase.status)}
          </span>
        </div>

        <dl className="details-grid">
          <div>
            <dt>Case ID</dt>
            <dd>{moderationCase.id}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{getStatusLabel(moderationCase.status)}</dd>
          </div>
          <div>
            <dt>Subject type</dt>
            <dd>{moderationCase.subjectType}</dd>
          </div>
          <div>
            <dt>Subject ID</dt>
            <dd>{moderationCase.subjectId}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDateTime(moderationCase.createdAt)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatDateTime(moderationCase.updatedAt)}</dd>
          </div>
        </dl>

        <section className="note-panel">
          <h3>Details</h3>
          <p>{moderationCase.details || "No details were provided."}</p>
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
            <p className="eyebrow">Audit timeline</p>
            <h2>Case timeline</h2>
            <p>
              Redacted moderation history, actions, and sensitive-access audit
              events for this case.
            </p>
          </div>
        </div>

        <div className="filter-row" aria-label="Timeline filters">
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
            No timeline events match this filter.
          </div>
        ) : (
          <div className="timeline">
            {visibleTimeline.map((item) => (
              <article className={`timeline-item ${item.type}`} key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  {item.note ? <p>{item.note}</p> : null}
                </div>

                <dl className="compact-details">
                  <div>
                    <dt>Actor</dt>
                    <dd>{getTimelineActorLabel(item)}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
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
      return "All";
    case "actions":
      return "Actions";
    case "notes":
      return "Notes";
    case "sensitive":
      return "Sensitive access";
    case "status":
      return "Status";
  }
}

function getTimelineActorLabel(item: AdminModerationTimelineItem): string {
  if (!item.actor) {
    return "System";
  }

  return item.actor.displayName ?? item.actor.id;
}

function formatMetadataKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatMetadataValue(
  value: string | number | boolean | string[] | null,
): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "none";
  }

  if (value === null) {
    return "none";
  }

  return String(value);
}

function getStatusLabel(status: AdminModerationCaseStatus): string {
  switch (status) {
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

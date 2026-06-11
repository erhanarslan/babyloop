"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminModerationAction,
  type AdminModerationActionType,
  type AdminModerationCaseDetail as AdminModerationCaseDetailType,
  type AdminModerationCaseStatus,
  getAdminModerationCase,
} from "./api";
import { ModerationActionForm } from "./moderation-action-form";
import { ModerationStatusForm } from "./moderation-status-form";
import { SensitiveAccessPanel } from "./sensitive-access-panel";

type ModerationCaseDetailProps = {
  caseId: string;
};

export function ModerationCaseDetail({ caseId }: ModerationCaseDetailProps) {
  const [moderationCase, setModerationCase] =
    useState<AdminModerationCaseDetailType | null>(null);
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

        <SensitiveAccessPanel moderationCase={moderationCase} />
      </section>

      <section className="content-card full-span">
        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Audit timeline</p>
            <h2>Case actions</h2>
            <p>Internal notes and workflow actions for this moderation case.</p>
          </div>
        </div>

        {moderationCase.actions.length === 0 ? (
          <div className="state-panel">No actions have been recorded yet.</div>
        ) : (
          <div className="timeline">
            {moderationCase.actions.map((action) => (
              <article className="timeline-item" key={action.id}>
                <div>
                  <strong>{getActionTypeLabel(getActionType(action))}</strong>
                  <p>{action.note || "No note."}</p>
                </div>

                <dl className="compact-details">
                  <div>
                    <dt>Admin user</dt>
                    <dd>{action.adminDisplayName ?? action.adminUserId ?? "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateTime(action.createdAt)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
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

function getActionType(action: AdminModerationAction): AdminModerationActionType {
  return action.type ?? action.actionType ?? "note";
}

function getActionTypeLabel(type: AdminModerationActionType): string {
  switch (type) {
    case "note":
      return "Note";
    case "review_started":
      return "Review started";
    case "dismissed":
      return "Dismissed";
    case "resolved":
      return "Resolved";
    case "action_taken":
      return "Action taken";
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

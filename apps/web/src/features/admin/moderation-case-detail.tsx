"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../../lib/api-error-message";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";
import {
  getAdminModerationCase,
  type AdminModerationAction,
  type AdminModerationActionType,
  type AdminModerationCaseDetail as AdminModerationCaseDetailType,
  type AdminModerationCaseStatus,
} from "./api";
import { ModerationActionForm } from "./moderation-action-form";
import { ModerationStatusForm } from "./moderation-status-form";

type ModerationCaseDetailProps = {
  caseId: string;
};

type DetailState =
  | {
      status: "loading";
    }
  | {
      status: "loaded";
      moderationCase: AdminModerationCaseDetailType;
    }
  | {
      status: "error";
      message: string;
    };

export function ModerationCaseDetail({ caseId }: ModerationCaseDetailProps) {
  const { dictionary } = useI18n();
  const [detailState, setDetailState] = useState<DetailState>({
    status: "loading",
  });

  useEffect(() => {
    let isActive = true;

    async function loadCase() {
      setDetailState({ status: "loading" });

      const response = await getAdminModerationCase(caseId);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setDetailState({
          status: "error",
          message: getApiErrorMessage(response.error, dictionary),
        });
        return;
      }

      setDetailState({
        status: "loaded",
        moderationCase: response.data.case,
      });
    }

    void loadCase();

    return () => {
      isActive = false;
    };
  }, [caseId, dictionary]);

  if (detailState.status === "loading") {
    return (
      <section className="empty-state" aria-busy="true" aria-live="polite">
        <h1>{dictionary.admin.moderation.caseTitle}</h1>
        <p>{dictionary.admin.moderation.loadingCase}</p>
      </section>
    );
  }

  if (detailState.status === "error") {
    return (
      <section className="empty-state" role="alert">
        <h1>{dictionary.admin.moderation.loadCaseFailedTitle}</h1>
        <p>{detailState.message}</p>
        <Link className="secondary-link" href="/admin/moderation">
          {dictionary.admin.moderation.backToCases}
        </Link>
      </section>
    );
  }

  const moderationCase = detailState.moderationCase;

  function handleCaseUpdated(updatedCase: AdminModerationCaseDetailType) {
    setDetailState({
      status: "loaded",
      moderationCase: updatedCase,
    });
  }

  return (
    <section className="grid gap-4">
      <div>
        <Link className="secondary-link" href="/admin/moderation">
          {dictionary.admin.moderation.backToCases}
        </Link>
      </div>

      <article className="grid gap-4 rounded-lg border border-border bg-card/80 p-6">
        <div className="grid gap-2">
          <h1>
            {dictionary.admin.moderation.caseTitle}{" "}
            <span className="font-mono">{moderationCase.id.slice(0, 8)}</span>
          </h1>

          <p>
            <strong>{dictionary.admin.moderation.status}:</strong>{" "}
            {getCaseStatusLabel(moderationCase.status, dictionary)}
          </p>

          <p>
            <strong>{dictionary.admin.moderation.subject}:</strong>{" "}
            {moderationCase.subjectType} /{" "}
            <span className="font-mono">{moderationCase.subjectId}</span>
          </p>

          {moderationCase.reason ? (
            <p>
              <strong>{dictionary.admin.moderation.reason}:</strong>{" "}
              {moderationCase.reason}
            </p>
          ) : null}

          {moderationCase.details ? (
            <p>
              <strong>{dictionary.admin.moderation.details}:</strong>{" "}
              {moderationCase.details}
            </p>
          ) : null}

          {moderationCase.createdAt ? (
            <p>
              <strong>{dictionary.admin.moderation.created}:</strong>{" "}
              {formatDateTime(moderationCase.createdAt)}
            </p>
          ) : null}

          {moderationCase.updatedAt ? (
            <p>
              <strong>{dictionary.admin.moderation.updated}:</strong>{" "}
              {formatDateTime(moderationCase.updatedAt)}
            </p>
          ) : null}
        </div>
      </article>

      <ModerationStatusForm
        caseId={moderationCase.id}
        currentStatus={moderationCase.status}
        onUpdated={handleCaseUpdated}
      />

      <ModerationActionForm
        caseId={moderationCase.id}
        onCreated={handleCaseUpdated}
      />

      <section className="grid gap-3 rounded-lg border border-border bg-card/80 p-6">
        <div className="grid gap-1">
          <h2>{dictionary.admin.moderation.auditActionsTitle}</h2>
          <p>{dictionary.admin.moderation.auditActionsDescription}</p>
        </div>

        {moderationCase.actions && moderationCase.actions.length > 0 ? (
          <div className="grid gap-3">
            {moderationCase.actions.map((action) => (
              <ModerationActionItem
                key={action.id}
                action={action}
                dictionary={dictionary}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state" role="status">
            <p>{dictionary.admin.moderation.noAuditActions}</p>
          </div>
        )}
      </section>
    </section>
  );
}

function ModerationActionItem({
  action,
  dictionary,
}: {
  action: AdminModerationAction;
  dictionary: Dictionary;
}) {
  return (
    <article className="grid gap-1 rounded-lg border border-border bg-background/60 p-4">
      <p>
        <strong>{dictionary.admin.moderation.type}:</strong>{" "}
        {getActionTypeLabel(action.type, dictionary)}
      </p>

      {action.note ? (
        <p>
          <strong>{dictionary.admin.moderation.note}:</strong> {action.note}
        </p>
      ) : null}

      {action.createdByUserId ? (
        <p>
          <strong>{dictionary.admin.moderation.adminUser}:</strong>{" "}
          <span className="font-mono">{action.createdByUserId}</span>
        </p>
      ) : null}

      {action.createdAt ? (
        <p>
          <strong>{dictionary.admin.moderation.created}:</strong>{" "}
          {formatDateTime(action.createdAt)}
        </p>
      ) : null}
    </article>
  );
}

function getCaseStatusLabel(
  status: AdminModerationCaseStatus,
  dictionary: Dictionary,
): string {
  switch (status) {
    case "pending":
      return dictionary.admin.moderation.pending;
    case "in_review":
      return dictionary.admin.moderation.inReview;
    case "resolved":
      return dictionary.admin.moderation.resolved;
    case "dismissed":
      return dictionary.admin.moderation.dismissed;
  }
}

function getActionTypeLabel(
  type: AdminModerationActionType,
  dictionary: Dictionary,
): string {
  switch (type) {
    case "note":
      return dictionary.admin.moderation.note;
    case "review_started":
      return dictionary.admin.moderation.reviewStarted;
    case "dismissed":
      return dictionary.admin.moderation.dismissed;
    case "resolved":
      return dictionary.admin.moderation.resolved;
    case "action_taken":
      return dictionary.admin.moderation.actionTaken;
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}
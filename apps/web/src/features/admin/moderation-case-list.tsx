"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import {
  listAdminModerationCases,
  type AdminModerationCaseSummary,
  type AdminModerationCaseStatus,
} from "./api";

type ModerationCaseListProps = {
  initialStatus?: AdminModerationCaseStatus;
};

type ListState =
  | {
      status: "loading";
    }
  | {
      status: "loaded";
      cases: AdminModerationCaseSummary[];
    }
  | {
      status: "error";
      message: string;
    };

const STATUS_FILTERS: Array<AdminModerationCaseStatus | "all"> = [
  "all",
  "pending",
  "in_review",
  "resolved",
  "dismissed",
];

export function ModerationCaseList({
  initialStatus,
}: ModerationCaseListProps) {
  const { dictionary } = useI18n();
  const [selectedStatus, setSelectedStatus] = useState<
    AdminModerationCaseStatus | "all"
  >(initialStatus ?? "all");

  const [listState, setListState] = useState<ListState>({
    status: "loading",
  });

  useEffect(() => {
    let isActive = true;

    async function loadCases() {
      setListState({ status: "loading" });

      const response = await listAdminModerationCases(
        selectedStatus === "all" ? undefined : { status: selectedStatus },
      );

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setListState({
          status: "error",
          message: getApiErrorMessage(response.error, dictionary),
        });
        return;
      }

      setListState({
        status: "loaded",
        cases: response.data.cases,
      });
    }

    void loadCases();

    return () => {
      isActive = false;
    };
  }, [selectedStatus, dictionary]);

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1>{dictionary.admin.moderation.casesTitle}</h1>
        <p>{dictionary.admin.moderation.casesDescription}</p>
      </div>

      <div
        className="flex flex-wrap gap-2"
        aria-label={dictionary.admin.moderation.status}
      >
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            className={selectedStatus === status ? "primary-link" : "secondary-link"}
            onClick={() => setSelectedStatus(status)}
          >
            {getStatusFilterLabel(status, dictionary)}
          </button>
        ))}
      </div>

      {listState.status === "loading" ? (
        <div className="empty-state" aria-busy="true" aria-live="polite">
          <p>{dictionary.admin.moderation.loadingCases}</p>
        </div>
      ) : null}

      {listState.status === "error" ? (
        <div className="empty-state" role="alert">
          <h2>{dictionary.admin.moderation.loadCasesFailedTitle}</h2>
          <p>{listState.message}</p>
        </div>
      ) : null}

      {listState.status === "loaded" && listState.cases.length === 0 ? (
        <div className="empty-state" role="status">
          <h2>{dictionary.admin.moderation.noCasesTitle}</h2>
          <p>{dictionary.admin.moderation.noCasesBody}</p>
        </div>
      ) : null}

      {listState.status === "loaded" && listState.cases.length > 0 ? (
        <div className="grid gap-3">
          {listState.cases.map((moderationCase) => (
            <article
              key={moderationCase.id}
              className="grid gap-3 rounded-lg border border-border bg-card/80 p-4"
            >
              <div className="grid gap-1">
                <h2>
                  {dictionary.admin.moderation.caseLabel}{" "}
                  <span className="font-mono">
                    {moderationCase.id.slice(0, 8)}
                  </span>
                </h2>

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

                {moderationCase.createdAt ? (
                  <p>
                    <strong>{dictionary.admin.moderation.created}:</strong>{" "}
                    {new Date(moderationCase.createdAt).toLocaleString()}
                  </p>
                ) : null}
              </div>

              <div>
                <Link
                  className="primary-link"
                  href={`/admin/moderation/${moderationCase.id}`}
                >
                  {dictionary.admin.moderation.openCase}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getStatusFilterLabel(
  status: AdminModerationCaseStatus | "all",
  dictionary: ReturnType<typeof useI18n>["dictionary"],
): string {
  if (status === "all") {
    return dictionary.admin.moderation.all;
  }

  return getCaseStatusLabel(status, dictionary);
}

function getCaseStatusLabel(
  status: AdminModerationCaseStatus,
  dictionary: ReturnType<typeof useI18n>["dictionary"],
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
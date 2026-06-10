"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminModerationCase,
  type AdminModerationCaseStatus,
  listAdminModerationCases,
} from "./api";

type StatusFilter = AdminModerationCaseStatus | "all";

const statusFilters: StatusFilter[] = [
  "all",
  "pending",
  "in_review",
  "resolved",
  "dismissed",
];

export function ModerationCaseList() {
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [cases, setCases] = useState<AdminModerationCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCases() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await listAdminModerationCases(
        selectedStatus === "all" ? undefined : { status: selectedStatus },
      );

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setCases([]);
        setErrorMessage(getApiErrorMessage(response, "Could not load cases."));
        setIsLoading(false);
        return;
      }

      setCases(response.data.cases);
      setIsLoading(false);
    }

    void loadCases();

    return () => {
      isActive = false;
    };
  }, [selectedStatus]);

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

      <div className="filter-row" aria-label="Moderation case status filters">
        {statusFilters.map((status) => (
          <button
            className={selectedStatus === status ? "filter-pill active" : "filter-pill"}
            key={status}
            onClick={() => setSelectedStatus(status)}
            type="button"
          >
            {getStatusLabel(status)}
          </button>
        ))}
      </div>

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

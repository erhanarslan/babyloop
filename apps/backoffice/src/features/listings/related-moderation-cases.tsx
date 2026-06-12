import Link from "next/link";

import type { AdminListingRelatedCase } from "./api";

type RelatedModerationCasesProps = {
  cases: AdminListingRelatedCase[];
};

export function RelatedModerationCases({ cases }: RelatedModerationCasesProps) {
  return (
    <section className="form-card">
      <div>
        <p className="eyebrow">Moderation</p>
        <h3>Related cases</h3>
        <p>
          Safe summaries only. Reporter identity and raw message data stay
          redacted in listing review.
        </p>
      </div>

      {cases.length === 0 ? (
        <div className="state-panel">No moderation cases are linked to this listing.</div>
      ) : (
        <div className="case-list">
          {cases.map((moderationCase) => (
            <article className="case-card compact-case-card" key={moderationCase.caseId}>
              <div>
                <div className="case-card-header">
                  <span className={`status-badge ${moderationCase.status}`}>
                    {getStatusLabel(moderationCase.status)}
                  </span>
                  <span className="muted">{moderationCase.reason ?? "No reason"}</span>
                </div>

                <dl className="compact-details">
                  <div>
                    <dt>Case ID</dt>
                    <dd>{moderationCase.caseId}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateTime(moderationCase.createdAt)}</dd>
                  </div>
                </dl>
              </div>

              <Link
                className="secondary-action"
                href={`/moderation/${moderationCase.caseId}`}
              >
                Open case
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "in_review":
      return "In review";
    case "resolved":
      return "Resolved";
    case "dismissed":
      return "Dismissed";
    default:
      return status;
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

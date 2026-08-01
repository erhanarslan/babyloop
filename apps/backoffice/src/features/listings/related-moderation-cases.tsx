import Link from "next/link";

import type { AdminListingRelatedCase } from "./api";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

type RelatedModerationCasesProps = {
  cases: AdminListingRelatedCase[];
};

export function RelatedModerationCases({ cases }: RelatedModerationCasesProps) {
  return (
    <section className="form-card">
      <div>
        <p className="eyebrow">Moderasyon</p>
        <h3>İlişkili vakalar</h3>
        <p>
          Yalnızca güvenli özetler gösterilir. Şikâyetçi kimliği ve ham mesaj verisi
          ilan incelemesine taşınmaz.
        </p>
      </div>

      {cases.length === 0 ? (
        <div className="state-panel">Bu ilanla ilişkili moderasyon vakası yok.</div>
      ) : (
        <div className="case-list">
          {cases.map((moderationCase) => (
            <article className="case-card compact-case-card" key={moderationCase.caseId}>
              <div>
                <div className="case-card-header">
                  <span className={`status-badge ${moderationCase.status}`}>
                    {getStatusLabel(moderationCase.status)}
                  </span>
                  <span className="muted">{moderationCase.reason ?? "Neden belirtilmedi"}</span>
                </div>

                <dl className="compact-details">
                  <div>
                    <dt>Vaka kimliği</dt>
                    <dd>{moderationCase.caseId}</dd>
                  </div>
                  <div>
                    <dt>Oluşturulma</dt>
                    <dd>{formatDateTime(moderationCase.createdAt)}</dd>
                  </div>
                </dl>
              </div>

              <Link
                className="secondary-action"
                href={`/moderation/${moderationCase.caseId}`}
              >
                Vakayı aç
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function getStatusLabel(status: string): string {
  return formatEnumLabel(status);
}

function formatDateTime(value: string): string {
  return formatDateTimeTr(value);
}

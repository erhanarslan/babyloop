"use client";

import type { ApiResponse } from "@babyloop/shared";
import { type FormEvent, useEffect, useState } from "react";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

import {
  type AdminModerationAiSummary,
  type AdminModerationAiSummaryRun,
  type AdminModerationCaseDetail,
  generateAdminModerationAiSummary,
  listAdminModerationAiSummaries,
} from "./api";

type AiSummaryPanelProps = {
  moderationCase: AdminModerationCaseDetail;
};

export function AiSummaryPanel({ moderationCase }: AiSummaryPanelProps) {
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState<AdminModerationAiSummary | null>(null);
  const [history, setHistory] = useState<AdminModerationAiSummaryRun[]>([]);
  const [auditEventId, setAuditEventId] = useState<string | null>(null);
  const [aiModelRunId, setAiModelRunId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyErrorMessage, setHistoryErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    setReason("");
    setSummary(null);
    setAuditEventId(null);
    setAiModelRunId(null);
    setErrorMessage(null);
    setHistory([]);
    setHistoryErrorMessage(null);
    setIsLoadingHistory(true);

    async function loadHistory() {
      const response = await listAdminModerationAiSummaries(moderationCase.id);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setHistoryErrorMessage(
          getApiErrorMessage(response, "AI özet geçmişi yüklenemedi."),
        );
        setIsLoadingHistory(false);
        return;
      }

      setHistory(response.data.summaries);
      setIsLoadingHistory(false);
    }

    void loadHistory();

    return () => {
      isActive = false;
    };
  }, [moderationCase.id]);

  async function refreshHistory() {
    const response = await listAdminModerationAiSummaries(moderationCase.id);

    if (response.ok) {
      setHistory(response.data.summaries);
      setHistoryErrorMessage(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setErrorMessage(null);

    const response = await generateAdminModerationAiSummary(moderationCase.id, {
      reason,
    });

    if (!response.ok) {
      setErrorMessage(getApiErrorMessage(response, "AI özeti oluşturulamadı."));
      setIsGenerating(false);
      await refreshHistory();
      return;
    }

    setSummary(response.data.summary);
    setAuditEventId(response.data.auditEventId);
    setAiModelRunId(response.data.aiModelRunId);
    setReason("");
    setIsGenerating(false);
    await refreshHistory();
  }

  return (
    <section className="content-card subtle-card">
      <div className="stack-sm">
        <div>
          <p className="eyebrow">AI ön değerlendirmesi</p>
          <h3>Hassas alanları çıkarılmış özet</h3>
          <p className="muted">
            Yalnızca hassas alanları çıkarılmış vaka bağlamından karar destek özeti
            üretir; şikâyetçi kimliği veya ham ileti verisi yüklenmez.
          </p>
        </div>

        <form className="stack-sm" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Oluşturma nedeni</span>
            <textarea
              maxLength={1000}
              minLength={10}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Bu güvenli AI özetinin neden gerekli olduğunu açıkla."
              required
              rows={3}
              value={reason}
            />
          </label>

          <button className="primary-action" disabled={isGenerating} type="submit">
            {isGenerating ? "Oluşturuluyor…" : "Güvenli özeti oluştur"}
          </button>
        </form>

        {errorMessage ? (
          <div className="state-panel danger" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {summary ? (
          <div className="note-panel ai-summary-result">
            <div className="page-toolbar compact-toolbar">
              <div>
                <p className="eyebrow">Risk: {formatEnumLabel(summary.riskLevel)}</p>
                <h4>{formatRecommendedAction(summary.recommendedAction)}</h4>
              </div>
              <span className="status-badge neutral">
                Güven %{Math.round(summary.confidenceScore * 100)}
              </span>
            </div>

            <p>{summary.summary}</p>

            <div className="compact-details two-column-list">
              <div>
                <dt>Sağlayıcı</dt>
                <dd>{summary.providerName}</dd>
              </div>
              <div>
                <dt>İstem sürümü</dt>
                <dd>{summary.promptVersion}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{summary.modelName ?? "Açıklanmadı"}</dd>
              </div>
              <div>
                <dt>AI çalışması</dt>
                <dd>{aiModelRunId ? shortId(aiModelRunId) : "Bulunmuyor"}</dd>
              </div>
              <div>
                <dt>Denetim olayı</dt>
                <dd>{auditEventId ? shortId(auditEventId) : "Bulunmuyor"}</dd>
              </div>
            </div>

            <div>
              <strong>Gerekçe</strong>
              <ul className="plain-list">
                {summary.rationale.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <strong>Güvenlik sinyalleri</strong>
              <div className="metadata-chip-row">
                {summary.safetySignals.map((signal) => (
                  <span className="metadata-chip" key={signal}>{signal}</span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="ai-summary-history">
          <div>
            <p className="eyebrow">AI geçmişi</p>
            <h4>Son güvenli çalışmalar</h4>
            <p className="muted">
              Son özetler güvenli AI çalışma üst verisinden gösterilir. Ham istemler,
              şikâyetçi kimliği ve ham ileti gövdeleri gösterilmez.
            </p>
          </div>

          {isLoadingHistory ? (
            <div className="state-panel">AI özet geçmişi yükleniyor…</div>
          ) : null}

          {historyErrorMessage ? (
            <div className="state-panel danger" role="alert">
              {historyErrorMessage}
            </div>
          ) : null}

          {!isLoadingHistory && !historyErrorMessage && history.length === 0 ? (
            <div className="state-panel">Henüz AI özeti oluşturulmadı.</div>
          ) : null}

          {history.length > 0 ? (
            <div className="ai-summary-run-list">
              {history.map((run) => (
                <article className={`ai-summary-run ${run.status}`} key={run.id}>
                  <div className="page-toolbar compact-toolbar">
                    <div>
                      <strong>{formatRunTitle(run)}</strong>
                      <p className="muted">{formatDateTimeTr(run.createdAt)}</p>
                    </div>
                    <span className="status-badge neutral">{formatEnumLabel(run.status)}</span>
                  </div>

                  {run.summary ? <p>{run.summary}</p> : null}
                  {run.errorMessage ? <p className="muted">{run.errorMessage}</p> : null}

                  <div className="metadata-chip-row">
                    <span className="metadata-chip">
                      <strong>Sağlayıcı</strong>
                      {run.providerName}
                    </span>
                    <span className="metadata-chip">
                      <strong>Model</strong>
                      {run.modelName ?? "Açıklanmadı"}
                    </span>
                    <span className="metadata-chip">
                      <strong>Çalışma</strong>
                      {shortId(run.id)}
                    </span>
                    {run.riskLevel ? (
                      <span className="metadata-chip">
                        <strong>Risk</strong>
                        {formatEnumLabel(run.riskLevel)}
                      </span>
                    ) : null}
                    {run.recommendedAction ? (
                      <span className="metadata-chip">
                        <strong>İşlem</strong>
                        {formatRecommendedAction(run.recommendedAction)}
                      </span>
                    ) : null}
                    {typeof run.confidenceScore === "number" ? (
                      <span className="metadata-chip">
                        <strong>Güven</strong>
                        {Math.round(run.confidenceScore * 100)}%
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function formatRunTitle(run: AdminModerationAiSummaryRun): string {
  if (run.recommendedAction) {
    return formatRecommendedAction(run.recommendedAction);
  }

  return run.status === "success" ? "Özet oluşturuldu" : "AI çalışması tamamlanmadı";
}

function formatRecommendedAction(action: AdminModerationAiSummary["recommendedAction"]): string {
  return formatEnumLabel(action);
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.code === "FORBIDDEN"
    ? "Bu AI özet işlemi için yetkin yok."
    : fallback;
}

"use client";

import type { ApiResponse } from "@babyloop/shared";
import { type FormEvent, useEffect, useState } from "react";

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
          getApiErrorMessage(response, "Could not load AI summary history."),
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
      setErrorMessage(getApiErrorMessage(response, "Could not generate AI summary."));
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
          <p className="eyebrow">AI triage</p>
          <h3>Redacted summary</h3>
          <p className="muted">
            Generates a triage-only summary from redacted case context. It does
            not call sensitive-access or load reporter identity/raw message data.
          </p>
        </div>

        <form className="stack-sm" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Generation reason</span>
            <textarea
              maxLength={1000}
              minLength={10}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this redacted AI summary is needed."
              required
              rows={3}
              value={reason}
            />
          </label>

          <button className="primary-action" disabled={isGenerating} type="submit">
            {isGenerating ? "Generating..." : "Generate redacted summary"}
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
                <p className="eyebrow">Risk: {summary.riskLevel}</p>
                <h4>{formatRecommendedAction(summary.recommendedAction)}</h4>
              </div>
              <span className="status-badge neutral">
                Confidence {Math.round(summary.confidenceScore * 100)}%
              </span>
            </div>

            <p>{summary.summary}</p>

            <div className="compact-details two-column-list">
              <div>
                <dt>Provider</dt>
                <dd>{summary.providerName}</dd>
              </div>
              <div>
                <dt>Prompt version</dt>
                <dd>{summary.promptVersion}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{summary.modelName ?? "Not disclosed"}</dd>
              </div>
              <div>
                <dt>AI run</dt>
                <dd>{aiModelRunId ? shortId(aiModelRunId) : "Not available"}</dd>
              </div>
              <div>
                <dt>Audit event</dt>
                <dd>{auditEventId ? shortId(auditEventId) : "Not available"}</dd>
              </div>
            </div>

            <div>
              <strong>Rationale</strong>
              <ul className="plain-list">
                {summary.rationale.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <strong>Safety signals</strong>
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
            <p className="eyebrow">AI history</p>
            <h4>Recent redacted runs</h4>
            <p className="muted">
              Recent summaries are shown from safe AI model-run metadata. Raw prompts,
              reporter identity, and raw message bodies are not displayed.
            </p>
          </div>

          {isLoadingHistory ? (
            <div className="state-panel">Loading AI summary history...</div>
          ) : null}

          {historyErrorMessage ? (
            <div className="state-panel danger" role="alert">
              {historyErrorMessage}
            </div>
          ) : null}

          {!isLoadingHistory && !historyErrorMessage && history.length === 0 ? (
            <div className="state-panel">No AI summaries have been generated yet.</div>
          ) : null}

          {history.length > 0 ? (
            <div className="ai-summary-run-list">
              {history.map((run) => (
                <article className={`ai-summary-run ${run.status}`} key={run.id}>
                  <div className="page-toolbar compact-toolbar">
                    <div>
                      <strong>{formatRunTitle(run)}</strong>
                      <p className="muted">{formatDateTime(run.createdAt)}</p>
                    </div>
                    <span className="status-badge neutral">{run.status}</span>
                  </div>

                  {run.summary ? <p>{run.summary}</p> : null}
                  {run.errorMessage ? <p className="muted">{run.errorMessage}</p> : null}

                  <div className="metadata-chip-row">
                    <span className="metadata-chip">
                      <strong>Provider</strong>
                      {run.providerName}
                    </span>
                    <span className="metadata-chip">
                      <strong>Model</strong>
                      {run.modelName ?? "Not disclosed"}
                    </span>
                    <span className="metadata-chip">
                      <strong>Run</strong>
                      {shortId(run.id)}
                    </span>
                    {run.riskLevel ? (
                      <span className="metadata-chip">
                        <strong>Risk</strong>
                        {run.riskLevel}
                      </span>
                    ) : null}
                    {run.recommendedAction ? (
                      <span className="metadata-chip">
                        <strong>Action</strong>
                        {formatRecommendedAction(run.recommendedAction)}
                      </span>
                    ) : null}
                    {typeof run.confidenceScore === "number" ? (
                      <span className="metadata-chip">
                        <strong>Confidence</strong>
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

  return run.status === "success" ? "Generated summary" : "AI run did not complete";
}

function formatRecommendedAction(action: AdminModerationAiSummary["recommendedAction"]): string {
  return action
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
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

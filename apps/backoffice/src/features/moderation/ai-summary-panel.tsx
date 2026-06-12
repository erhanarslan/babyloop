"use client";

import type { ApiResponse } from "@babyloop/shared";
import { type FormEvent, useEffect, useState } from "react";

import {
  type AdminModerationAiSummary,
  type AdminModerationCaseDetail,
  generateAdminModerationAiSummary,
} from "./api";

type AiSummaryPanelProps = {
  moderationCase: AdminModerationCaseDetail;
};

export function AiSummaryPanel({ moderationCase }: AiSummaryPanelProps) {
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState<AdminModerationAiSummary | null>(null);
  const [auditEventId, setAuditEventId] = useState<string | null>(null);
  const [aiModelRunId, setAiModelRunId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setReason("");
    setSummary(null);
    setAuditEventId(null);
    setAiModelRunId(null);
    setErrorMessage(null);
  }, [moderationCase.id]);

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
      return;
    }

    setSummary(response.data.summary);
    setAuditEventId(response.data.auditEventId);
    setAiModelRunId(response.data.aiModelRunId);
    setReason("");
    setIsGenerating(false);
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
      </div>
    </section>
  );
}

function formatRecommendedAction(action: AdminModerationAiSummary["recommendedAction"]): string {
  return action
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
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

  return response.error?.message ?? fallback;
}

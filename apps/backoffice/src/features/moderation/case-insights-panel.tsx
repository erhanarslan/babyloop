"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useState } from "react";

import {
  type AdminModerationCaseDetail,
  type AdminModerationCaseInsights,
  getAdminModerationCaseInsights,
} from "./api";

type CaseInsightsPanelProps = {
  moderationCase: AdminModerationCaseDetail;
};

export function CaseInsightsPanel({ moderationCase }: CaseInsightsPanelProps) {
  const [insights, setInsights] = useState<AdminModerationCaseInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadInsights() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminModerationCaseInsights(moderationCase.id);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setInsights(null);
        setErrorMessage(getApiErrorMessage(response, "Could not load case insights."));
        setIsLoading(false);
        return;
      }

      setInsights(response.data.insights);
      setIsLoading(false);
    }

    void loadInsights();

    return () => {
      isActive = false;
    };
  }, [moderationCase.id, moderationCase.updatedAt]);

  return (
    <section className="content-card insight-card">
      <div>
        <p className="eyebrow">Case insights</p>
        <h3>Decision support</h3>
        <p className="muted">
          Safe operational signals for this case. No reporter identity, raw message body,
          raw reason, or raw AI prompt is shown here.
        </p>
      </div>

      {isLoading ? <div className="state-panel">Loading case insights...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && insights ? (
        <div className="insight-stack">
          <div className="risk-score-card">
            <div>
              <span className={`risk-dot ${insights.risk.level}`} />
              <strong>{formatRiskLevel(insights.risk.level)}</strong>
              <p className="muted">Rules-based risk score</p>
            </div>
            <span className="risk-score-value">{insights.risk.score}</span>
          </div>

          <div className="metadata-chip-row">
            {insights.risk.signals.map((signal) => (
              <span className="metadata-chip" key={signal}>{signal}</span>
            ))}
          </div>

          <div className="note-panel compact-note-panel">
            <strong>Suggested next step</strong>
            <p>{insights.recommendedNextStep.label}</p>
          </div>

          {insights.targetProfile ? (
            <dl className="compact-details">
              <div>
                <dt>Profile</dt>
                <dd>{insights.targetProfile.displayName}</dd>
              </div>
              <div>
                <dt>Safety status</dt>
                <dd>{formatSafetyStatus(insights.targetProfile.safetyStatus)}</dd>
              </div>
              <div>
                <dt>Profile source</dt>
                <dd>{formatProfileSource(insights.targetProfile.source)}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">No safe target profile signal is available.</p>
          )}

          <div className="insight-metric-grid">
            <InsightMetric label="Open cases" value={insights.counts.openCasesForTarget} />
            <InsightMetric label="Total cases" value={insights.counts.totalCasesForTarget} />
            <InsightMetric label="Reports 7d" value={insights.counts.reportsLast7Days} />
            <InsightMetric label="Reports 30d" value={insights.counts.reportsLast30Days} />
            <InsightMetric label="Enforcement" value={insights.counts.priorEnforcementActions} />
            <InsightMetric label="Enforcement 30d" value={insights.counts.enforcementActionsLast30Days} />
            <InsightMetric label="Sensitive access" value={insights.counts.sensitiveAccessEvents} />
            <InsightMetric label="AI runs" value={insights.counts.aiSummaryRuns} />
          </div>

          {insights.latestAiSummary ? (
            <div className="note-panel compact-note-panel">
              <strong>Latest AI signal</strong>
              <p>
                {insights.latestAiSummary.riskLevel
                  ? `${formatRiskLevel(insights.latestAiSummary.riskLevel)} risk`
                  : "Risk not available"}
                {insights.latestAiSummary.recommendedAction
                  ? ` · ${formatAction(insights.latestAiSummary.recommendedAction)}`
                  : ""}
                {typeof insights.latestAiSummary.confidenceScore === "number"
                  ? ` · ${Math.round(insights.latestAiSummary.confidenceScore * 100)}% confidence`
                  : ""}
              </p>
              <p className="muted">{formatDateTime(insights.latestAiSummary.createdAt)}</p>
            </div>
          ) : (
            <p className="muted">No successful AI summary has been generated yet.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function InsightMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="insight-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatRiskLevel(level: AdminModerationCaseInsights["risk"]["level"] | "medium" | "high" | "low"): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function formatSafetyStatus(status: NonNullable<AdminModerationCaseInsights["targetProfile"]>["safetyStatus"]): string {
  return status.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatProfileSource(source: NonNullable<AdminModerationCaseInsights["targetProfile"]>["source"]): string {
  switch (source) {
    case "target_profile":
      return "Reported profile";
    case "listing_seller":
      return "Listing seller";
    case "message_sender":
      return "Message sender";
  }
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  return response.ok ? fallback : response.error.message;
}

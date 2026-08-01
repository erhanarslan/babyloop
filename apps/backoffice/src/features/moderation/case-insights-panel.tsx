"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useState } from "react";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

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
        setErrorMessage(getApiErrorMessage(response, "Vaka içgörüleri yüklenemedi."));
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
    <section aria-label="Moderasyon ön değerlendirme özeti" className="content-card insight-card">
      <div>
        <p className="eyebrow">Vaka içgörüleri</p>
        <h3>Karar desteği</h3>
        <p className="muted">
          Bu vaka için güvenli operasyon sinyalleri gösterilir. Şikâyetçi kimliği, ham mesaj
          gövdesi, ham neden veya ham AI istemi burada gösterilmez.
        </p>
      </div>

      {isLoading ? <div className="state-panel">Vaka içgörüleri yükleniyor…</div> : null}

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
              <p className="muted">Kural tabanlı risk puanı</p>
            </div>
            <span className="risk-score-value">{insights.risk.score}</span>
          </div>

          <div className="metadata-chip-row">
            {insights.risk.signals.map((signal) => (
              <span className="metadata-chip" key={signal}>{formatEnumLabel(signal)}</span>
            ))}
          </div>

          <div className="note-panel compact-note-panel">
            <strong>Önerilen sonraki adım</strong>
            <p>{formatRecommendation(insights.recommendedNextStep.code)}</p>
          </div>

          {insights.targetProfile ? (
            <dl className="compact-details">
              <div>
                <dt>Profil</dt>
                <dd>{insights.targetProfile.displayName}</dd>
              </div>
              <div>
                <dt>Güvenlik durumu</dt>
                <dd>{formatSafetyStatus(insights.targetProfile.safetyStatus)}</dd>
              </div>
              <div>
                <dt>Profil kaynağı</dt>
                <dd>{formatProfileSource(insights.targetProfile.source)}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Güvenli hedef profil sinyali bulunmuyor.</p>
          )}

          {insights.profileTrustSnapshot ? (
            <div className="trust-snapshot-card">
              <div>
                <p className="eyebrow">Profil güven görünümü</p>
                <strong>{formatRiskLevel(insights.profileTrustSnapshot.riskLevel)} profil riski</strong>
                <p className="muted">Hesaplanma: {formatDateTime(insights.profileTrustSnapshot.computedAt)}</p>
              </div>
              <dl className="compact-details">
                <div>
                  <dt>Güven puanı</dt>
                  <dd>{insights.profileTrustSnapshot.trustScore}</dd>
                </div>
                <div>
                  <dt>Risk puanı</dt>
                  <dd>{insights.profileTrustSnapshot.riskScore}</dd>
                </div>
                <div>
                  <dt>Açık profil vakaları</dt>
                  <dd>{insights.profileTrustSnapshot.openCaseCount}</dd>
                </div>
                <div>
                  <dt>Yakın tarihli şikâyetler</dt>
                  <dd>{insights.profileTrustSnapshot.recentReportCount}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="insight-metric-grid">
            <InsightMetric label="Açık vakalar" value={insights.counts.openCasesForTarget} />
            <InsightMetric label="Toplam vakalar" value={insights.counts.totalCasesForTarget} />
            <InsightMetric label="Son 7 gün şikâyetleri" value={insights.counts.reportsLast7Days} />
            <InsightMetric label="Son 30 gün şikâyetleri" value={insights.counts.reportsLast30Days} />
            <InsightMetric label="Yaptırım" value={insights.counts.priorEnforcementActions} />
            <InsightMetric label="Son 30 gün yaptırımları" value={insights.counts.enforcementActionsLast30Days} />
            <InsightMetric label="Hassas erişim" value={insights.counts.sensitiveAccessEvents} />
            <InsightMetric label="AI çalışmaları" value={insights.counts.aiSummaryRuns} />
          </div>

          {insights.latestAiSummary ? (
            <div className="note-panel compact-note-panel">
              <strong>Son AI sinyali</strong>
              <p>
                {insights.latestAiSummary.riskLevel
                  ? `${formatRiskLevel(insights.latestAiSummary.riskLevel)} risk`
                  : "Risk verisi yok"}
                {insights.latestAiSummary.recommendedAction
                  ? ` · ${formatAction(insights.latestAiSummary.recommendedAction)}`
                  : ""}
                {typeof insights.latestAiSummary.confidenceScore === "number"
                  ? ` · %${Math.round(insights.latestAiSummary.confidenceScore * 100)} güven`
                  : ""}
              </p>
              <p className="muted">{formatDateTime(insights.latestAiSummary.createdAt)}</p>
            </div>
          ) : (
            <p className="muted">Henüz başarılı AI özeti üretilmedi.</p>
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

function formatRiskLevel(level: AdminModerationCaseInsights["risk"]["level"]): string {
  return formatEnumLabel(level);
}

function formatSafetyStatus(status: NonNullable<AdminModerationCaseInsights["targetProfile"]>["safetyStatus"]): string {
  return formatEnumLabel(status);
}

function formatProfileSource(source: NonNullable<AdminModerationCaseInsights["targetProfile"]>["source"]): string {
  switch (source) {
    case "target_profile":
      return "Şikâyet edilen profil";
    case "listing_seller":
      return "İlan satıcısı";
    case "message_sender":
      return "Mesaj gönderen";
  }
}

function formatAction(action: string): string {
  return formatEnumLabel(action);
}

function formatRecommendation(code: string): string {
  switch (code) {
    case "consider_enforcement":
      return "Vakayı kapatmadan önce yaptırım seçeneklerini ve geçmiş işlemleri incele.";
    case "review_sensitive_context":
      return "Yaptırım uygulamadan önce hassas bağlama erişimin gerekli olup olmadığını değerlendir.";
    case "monitor_only":
      return "Mevcut profil yaptırımı etkin; yalnız izlemenin yeterli olup olmadığını doğrula.";
    case "continue_review":
      return "Zaman çizelgesi, AI geçmişi ve yaptırım bağlamıyla incelemeye devam et.";
    default:
      return "Vaka ayrıntılarını inceleyerek güvenli sonraki adımı belirle.";
  }
}

function formatDateTime(value: string): string {
  return formatDateTimeTr(value);
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  return response.ok || response.error.code !== "FORBIDDEN"
    ? fallback
    : "Vaka içgörülerini görüntüleme yetkin yok.";
}

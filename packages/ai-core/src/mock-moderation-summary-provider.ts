import { MODERATION_SUMMARY_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  ModerationSummaryInput,
  ModerationSummaryOutput,
  ModerationSummaryProvider
} from "./types.js";

const MOCK_PROVIDER_NAME = "mock-moderation-summary";

export class MockModerationSummaryProvider implements ModerationSummaryProvider {
  readonly providerName = MOCK_PROVIDER_NAME;

  async summarizeModerationCase(
    input: ModerationSummaryInput
  ): Promise<ModerationSummaryOutput> {
    const riskLevel = inferRiskLevel(input);
    const recommendedAction = inferRecommendedAction(input, riskLevel);
    const safetySignals = buildSafetySignals(input, riskLevel);

    return {
      summary: buildSummary(input, riskLevel),
      riskLevel,
      recommendedAction,
      rationale: buildRationale(input, riskLevel, recommendedAction),
      safetySignals,
      confidenceScore: calculateConfidenceScore(input, safetySignals.length),
      providerName: this.providerName,
      promptVersion: MODERATION_SUMMARY_PROMPT_VERSION
    };
  }
}

export const mockModerationSummaryProvider = new MockModerationSummaryProvider();

function inferRiskLevel(input: ModerationSummaryInput): ModerationSummaryOutput["riskLevel"] {
  const text = [
    input.reportReason,
    input.targetPreview?.summary,
    ...input.recentTimelineLabels,
    ...input.previousEnforcementActions
  ]
    .join(" ")
    .toLowerCase();

  if (/(fraud|scam|unsafe|danger|abuse|harassment|threat|suspend|restricted)/.test(text)) {
    return "high";
  }

  if (/(message|profile|report|hide|review|safety|moderation)/.test(text)) {
    return "medium";
  }

  return "low";
}

function inferRecommendedAction(
  input: ModerationSummaryInput,
  riskLevel: ModerationSummaryOutput["riskLevel"]
): ModerationSummaryOutput["recommendedAction"] {
  if (input.targetType === "profile" && riskLevel === "high") {
    return "restrict_profile";
  }

  if (input.targetType === "listing" && riskLevel !== "low") {
    return "hide_listing";
  }

  if (input.targetType === "message" && riskLevel !== "low") {
    return "hide_message";
  }

  if (riskLevel === "high") {
    return "escalate";
  }

  if (riskLevel === "medium") {
    return "continue_review";
  }

  return "dismiss_or_monitor";
}

function buildSummary(
  input: ModerationSummaryInput,
  riskLevel: ModerationSummaryOutput["riskLevel"]
): string {
  const targetLabel = `${input.targetType} ${input.targetId.slice(0, 8)}`;
  const reason = input.reportReason ? ` Report reason: ${input.reportReason}.` : "";

  return `Redacted review summary for ${targetLabel}: current risk appears ${riskLevel}.${reason} Use this as a triage aid only; a human moderator must make the final decision.`;
}

function buildRationale(
  input: ModerationSummaryInput,
  riskLevel: ModerationSummaryOutput["riskLevel"],
  recommendedAction: ModerationSummaryOutput["recommendedAction"]
): string[] {
  const rationale = [
    `The case target is ${input.targetType}.`,
    `The redacted context indicates ${riskLevel} risk.`,
    `Recommended next action: ${recommendedAction.replace(/_/g, " ")}.`
  ];

  if (input.previousEnforcementActions.length > 0) {
    rationale.push("Previous enforcement activity exists and should be reviewed before acting.");
  }

  return rationale;
}

function buildSafetySignals(
  input: ModerationSummaryInput, riskLevel: string): string[] {
  const signals = [
    `target:${input.targetType}`,
    `status:${input.status}`,
    `risk:${riskLevel}`
  ];

  if (input.targetPreview?.safetyStatus) {
    signals.push(`profile_safety_status:${input.targetPreview.safetyStatus}`);
  }

  if (input.previousEnforcementActions.length > 0) {
    signals.push("prior_enforcement_present");
  }

  return signals;
}

function calculateConfidenceScore(
  input: ModerationSummaryInput,
  signalCount: number
): number {
  const hasPreview = input.targetPreview ? 0.1 : 0;
  const hasReason = input.reportReason ? 0.1 : 0;
  const timelineBoost = Math.min(input.recentTimelineLabels.length, 4) * 0.03;
  const rawScore = 0.45 + hasPreview + hasReason + timelineBoost + signalCount * 0.02;

  return Math.min(Math.round(rawScore * 100) / 100, 0.86);
}

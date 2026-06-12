import {
  MODERATION_SUMMARY_PROMPT_VERSION,
  summarizeModerationCase,
  type ModerationSummaryInput,
  type ModerationSummaryOutput
} from "@babyloop/ai-core";
import { aiModelRuns, events } from "@babyloop/database/schema";
import type { FastifyInstance } from "fastify";
import { getAdminModerationCaseDetail } from "./admin-moderation.service.js";

const AI_MODERATION_SUMMARY_FEATURE = "moderation_summary";
const MOCK_AI_MODEL_NAME = "mock-model";
const MOCK_AI_PROVIDER_NAME = "mock-moderation-summary";

export type AdminModerationAiSummaryResult =
  | {
      status: "generated";
      caseId: string;
      aiModelRunId: string;
      auditEventId: string;
      summary: ModerationSummaryOutput;
    }
  | { status: "not_found" }
  | { status: "error"; errorMessage: string };

export async function generateAdminModerationAiSummary(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    caseId: string;
    reason: string;
  }
): Promise<AdminModerationAiSummaryResult> {
  const detail = await getAdminModerationCaseDetail(app, params.caseId);

  if (detail.status === "not_found") {
    return { status: "not_found" };
  }

  const input = buildRedactedModerationSummaryInput(detail);

  try {
    const summary = await summarizeModerationCase(input);
    const aiModelRunId = await recordModerationAiModelRun(app, {
      input,
      output: summary,
      confidenceScore: summary.confidenceScore,
      riskScore: riskScoreForLevel(summary.riskLevel),
      providerName: summary.providerName,
      promptVersion: summary.promptVersion,
      status: "success"
    });
    const auditEventId = await recordModerationAiSummaryAuditEvent(app, {
      actorProfileId: params.actorProfileId,
      caseId: params.caseId,
      targetType: detail.case.targetType,
      targetId: detail.case.targetId,
      aiModelRunId,
      providerName: summary.providerName,
      promptVersion: summary.promptVersion,
      confidenceScore: summary.confidenceScore,
      riskLevel: summary.riskLevel,
      recommendedAction: summary.recommendedAction,
      reasonLength: params.reason.length
    });

    return {
      status: "generated",
      caseId: params.caseId,
      aiModelRunId,
      auditEventId,
      summary
    };
  } catch (error) {
    const errorMessage = getSafeErrorMessage(error);

    await recordModerationAiModelRun(app, {
      input,
      providerName: MOCK_AI_PROVIDER_NAME,
      promptVersion: MODERATION_SUMMARY_PROMPT_VERSION,
      status: "error",
      errorMessage
    });

    return { status: "error", errorMessage };
  }
}

function buildRedactedModerationSummaryInput(
  detail: Extract<Awaited<ReturnType<typeof getAdminModerationCaseDetail>>, { status: "found" }>
): ModerationSummaryInput {
  return {
    caseId: detail.case.id,
    targetType: detail.case.targetType,
    targetId: detail.case.targetId,
    status: detail.case.status,
    priority: detail.case.priority,
    ...(detail.case.report?.reason ? { reportReason: detail.case.report.reason } : {}),
    ...(detail.case.targetPreview
      ? { targetPreview: toModerationSummaryTargetPreview(detail.case.targetPreview) }
      : {}),
    recentTimelineLabels: detail.timeline.slice(0, 10).map((item) => item.label),
    previousEnforcementActions: detail.timeline
      .map((item) => item.metadata?.action)
      .filter((value): value is string => typeof value === "string")
      .slice(0, 10)
  };
}

function toModerationSummaryTargetPreview(
  preview: NonNullable<
    Extract<Awaited<ReturnType<typeof getAdminModerationCaseDetail>>, { status: "found" }>["case"]["targetPreview"]
  >
): ModerationSummaryInput["targetPreview"] {
  if (preview.type === "listing") {
    return {
      type: "listing",
      summary: `Listing ${preview.id.slice(0, 8)}: ${preview.title} (${preview.status})`
    };
  }

  if (preview.type === "profile") {
    return {
      type: "profile",
      summary: `Profile ${preview.id.slice(0, 8)}: ${preview.displayName}`,
      safetyStatus: preview.safetyStatus
    };
  }

  return {
    type: "message",
    summary: `Message ${preview.id.slice(0, 8)} preview: ${preview.bodyPreview}`
  };
}

type AiModelRunLogInput = {
  input: ModerationSummaryInput;
  output?: ModerationSummaryOutput;
  providerName: string;
  promptVersion: string;
  confidenceScore?: number;
  riskScore?: number;
  status: "success" | "error";
  errorMessage?: string;
};

async function recordModerationAiModelRun(
  app: FastifyInstance,
  run: AiModelRunLogInput
): Promise<string> {
  const [created] = await app.db
    .insert(aiModelRuns)
    .values({
      feature: AI_MODERATION_SUMMARY_FEATURE,
      providerName: run.providerName,
      modelName: MOCK_AI_MODEL_NAME,
      promptVersion: run.promptVersion,
      input: { ...run.input },
      output: run.output ? { ...run.output } : null,
      confidenceScore:
        typeof run.confidenceScore === "number" ? run.confidenceScore.toFixed(4) : null,
      riskScore: typeof run.riskScore === "number" ? run.riskScore.toFixed(4) : null,
      status: run.status,
      errorMessage: run.errorMessage ?? null
    })
    .returning({ id: aiModelRuns.id });

  return created.id;
}

async function recordModerationAiSummaryAuditEvent(
  app: FastifyInstance,
  input: {
    actorProfileId: string;
    caseId: string;
    targetType: string;
    targetId: string;
    aiModelRunId: string;
    providerName: string;
    promptVersion: string;
    confidenceScore: number;
    riskLevel: string;
    recommendedAction: string;
    reasonLength: number;
  }
): Promise<string> {
  const [created] = await app.db
    .insert(events)
    .values({
      actorProfileId: input.actorProfileId,
      eventType: "admin_ai_moderation_summary_generated",
      entityType: "moderation_case",
      entityId: input.caseId,
      metadata: {
        caseId: input.caseId,
        targetType: input.targetType,
        targetId: input.targetId,
        aiModelRunId: input.aiModelRunId,
        providerName: input.providerName,
        promptVersion: input.promptVersion,
        confidenceScore: input.confidenceScore,
        riskLevel: input.riskLevel,
        recommendedAction: input.recommendedAction,
        reasonLength: input.reasonLength,
        result: "generated"
      }
    })
    .returning({ id: events.id });

  return created.id;
}

function riskScoreForLevel(level: ModerationSummaryOutput["riskLevel"]): number {
  switch (level) {
    case "high":
      return 0.85;
    case "medium":
      return 0.6;
    case "low":
      return 0.25;
  }
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 500);
  }

  return "Moderation summary generation failed.";
}

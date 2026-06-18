import {
  MODERATION_SUMMARY_GEMINI_PROMPT_VERSION,
  MODERATION_SUMMARY_OPENAI_PROMPT_VERSION,
  MODERATION_SUMMARY_PROMPT_VERSION,
  summarizeModerationCase,
  type ModerationSummaryInput,
  type ModerationSummaryOutput,
  type ModerationSummaryProvider
} from "@babyloop/ai-core";
import { aiModelRuns, events } from "@babyloop/database/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { getAdminModerationCaseDetail } from "./admin-moderation.service.js";
import { createSafeTextPreview } from "./redaction.service.js";

const AI_MODERATION_SUMMARY_FEATURE = "moderation_summary";
const MOCK_AI_MODEL_NAME = "mock-model";
const MOCK_AI_PROVIDER_NAME = "mock-moderation-summary";
const AI_MODERATION_SUMMARY_RATE_LIMIT_SECONDS = 5 * 60;

export type AdminModerationAiSummaryRunSummary = {
  id: string;
  caseId: string | null;
  status: "success" | "error" | "validation_failed" | "provider_failed" | "skipped";
  providerName: string;
  modelName: string | null;
  promptVersion: string;
  summary: string | null;
  riskLevel: ModerationSummaryOutput["riskLevel"] | null;
  recommendedAction: ModerationSummaryOutput["recommendedAction"] | null;
  confidenceScore: number | null;
  riskScore: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export type AdminModerationAiSummariesResult =
  | { status: "found"; caseId: string; summaries: AdminModerationAiSummaryRunSummary[] }
  | { status: "not_found" };

export type AdminModerationAiSummaryResult =
  | {
      status: "generated";
      caseId: string;
      aiModelRunId: string;
      auditEventId: string;
      summary: ModerationSummaryOutput;
    }
  | {
      status: "rate_limited";
      caseId: string;
      retryAfterSeconds: number;
      nextAllowedAt: string;
      latestSummary: AdminModerationAiSummaryRunSummary;
    }
  | { status: "not_found" }
  | { status: "error"; errorMessage: string };

export async function generateAdminModerationAiSummary(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    caseId: string;
    provider?: ModerationSummaryProvider;
    reason: string;
  }
): Promise<AdminModerationAiSummaryResult> {
  const detail = await getAdminModerationCaseDetail(app, params.caseId);

  if (detail.status === "not_found") {
    return { status: "not_found" };
  }

  const input = buildRedactedModerationSummaryInput(detail);
  const recentSummary = await getLatestSuccessfulModerationAiSummaryRun(
    app,
    params.caseId,
    AI_MODERATION_SUMMARY_RATE_LIMIT_SECONDS
  );

  if (recentSummary) {
    const nextAllowedAt = new Date(
      new Date(recentSummary.createdAt).getTime() + AI_MODERATION_SUMMARY_RATE_LIMIT_SECONDS * 1000
    );

    return {
      status: "rate_limited",
      caseId: params.caseId,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((nextAllowedAt.getTime() - Date.now()) / 1000)
      ),
      nextAllowedAt: nextAllowedAt.toISOString(),
      latestSummary: recentSummary
    };
  }

  try {
    const summary = await summarizeModerationCase(input, {
      ...(params.provider ? { provider: params.provider } : {})
    });

    const aiModelRunId = await recordModerationAiModelRun(app, {
      input,
      output: summary,
      confidenceScore: summary.confidenceScore,
      riskScore: riskScoreForLevel(summary.riskLevel),
      modelName: summary.modelName ?? params.provider?.modelName ?? MOCK_AI_MODEL_NAME,
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
      modelName: summary.modelName ?? params.provider?.modelName ?? MOCK_AI_MODEL_NAME,
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
      providerName: params.provider?.providerName ?? MOCK_AI_PROVIDER_NAME,
      modelName: params.provider?.modelName ?? MOCK_AI_MODEL_NAME,
      promptVersion: getPromptVersionForProvider(params.provider),
      status: "error",
      errorMessage
    });

    return { status: "error", errorMessage };
  }
}


export async function listAdminModerationAiSummaries(
  app: FastifyInstance,
  params: {
    caseId: string;
    limit: number;
  }
): Promise<AdminModerationAiSummariesResult> {
  const detail = await getAdminModerationCaseDetail(app, params.caseId);

  if (detail.status === "not_found") {
    return { status: "not_found" };
  }

  const summaries = await listModerationAiSummaryRuns(app, {
    caseId: params.caseId,
    limit: params.limit
  });

  return {
    status: "found",
    caseId: params.caseId,
    summaries
  };
}

function buildRedactedModerationSummaryInput(
  detail: Extract<Awaited<ReturnType<typeof getAdminModerationCaseDetail>>, { status: "found" }>
): ModerationSummaryInput {
  const input: ModerationSummaryInput = {
    caseId: detail.case.id,
    targetType: detail.case.targetType,
    targetId: detail.case.targetId,
    status: detail.case.status,
    priority: detail.case.priority,
    recentTimelineLabels: detail.timeline.slice(0, 10).map((item) => item.label),
    previousEnforcementActions: detail.timeline
      .map((item) => item.metadata?.action)
      .filter((value): value is string => typeof value === "string")
      .slice(0, 10)
  };

  if (detail.case.report?.reason) {
    input.reportReason = createSafeTextPreview(detail.case.report.reason, 240);
  }

  if (detail.case.targetPreview) {
    input.targetPreview = toModerationSummaryTargetPreview(detail.case.targetPreview);
  }

  return input;
}

function toModerationSummaryTargetPreview(
  preview: NonNullable<
    Extract<Awaited<ReturnType<typeof getAdminModerationCaseDetail>>, { status: "found" }>["case"]["targetPreview"]
  >
): NonNullable<ModerationSummaryInput["targetPreview"]> {
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


async function getLatestSuccessfulModerationAiSummaryRun(
  app: FastifyInstance,
  caseId: string,
  withinSeconds: number
): Promise<AdminModerationAiSummaryRunSummary | null> {
  const [latest] = await queryModerationAiSummaryRuns(app, {
    caseId,
    limit: 1,
    status: "success",
    createdSince: new Date(Date.now() - withinSeconds * 1000)
  });

  return latest ? mapAiModelRunSummary(latest) : null;
}

async function listModerationAiSummaryRuns(
  app: FastifyInstance,
  params: {
    caseId: string;
    limit: number;
  }
): Promise<AdminModerationAiSummaryRunSummary[]> {
  const rows = await queryModerationAiSummaryRuns(app, {
    caseId: params.caseId,
    limit: params.limit
  });

  return rows.map(mapAiModelRunSummary);
}

type AiModelRunSummaryRow = {
  id: string;
  providerName: string;
  modelName: string | null;
  promptVersion: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  confidenceScore: string | null;
  riskScore: string | null;
  status: "success" | "error" | "validation_failed" | "provider_failed" | "skipped";
  errorMessage: string | null;
  createdAt: Date;
};

async function queryModerationAiSummaryRuns(
  app: FastifyInstance,
  params: {
    caseId: string;
    limit: number;
    status?: "success" | "error" | "validation_failed" | "provider_failed" | "skipped";
    createdSince?: Date;
  }
): Promise<AiModelRunSummaryRow[]> {
  const whereClauses = [
    eq(aiModelRuns.feature, AI_MODERATION_SUMMARY_FEATURE),
    sql`${aiModelRuns.input}->>'caseId' = ${params.caseId}`
  ];

  if (params.status) {
    whereClauses.push(eq(aiModelRuns.status, params.status));
  }

  if (params.createdSince) {
    whereClauses.push(gte(aiModelRuns.createdAt, params.createdSince));
  }

  return app.db
    .select({
      id: aiModelRuns.id,
      providerName: aiModelRuns.providerName,
      modelName: aiModelRuns.modelName,
      promptVersion: aiModelRuns.promptVersion,
      input: aiModelRuns.input,
      output: aiModelRuns.output,
      confidenceScore: aiModelRuns.confidenceScore,
      riskScore: aiModelRuns.riskScore,
      status: aiModelRuns.status,
      errorMessage: aiModelRuns.errorMessage,
      createdAt: aiModelRuns.createdAt
    })
    .from(aiModelRuns)
    .where(and(...whereClauses))
    .orderBy(desc(aiModelRuns.createdAt))
    .limit(params.limit);
}

function mapAiModelRunSummary(row: AiModelRunSummaryRow): AdminModerationAiSummaryRunSummary {
  const output = row.output ?? {};

  return {
    id: row.id,
    caseId: typeof row.input.caseId === "string" ? row.input.caseId : null,
    status: row.status,
    providerName: row.providerName,
    modelName: row.modelName,
    promptVersion: row.promptVersion,
    summary: getOptionalString(output.summary),
    riskLevel: getRiskLevel(output.riskLevel),
    recommendedAction: getRecommendedAction(output.recommendedAction),
    confidenceScore: parseOptionalNumber(row.confidenceScore),
    riskScore: parseOptionalNumber(row.riskScore),
    errorMessage: row.errorMessage ? row.errorMessage.slice(0, 300) : null,
    createdAt: row.createdAt.toISOString()
  };
}

function getOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.slice(0, 500) : null;
}

function getRiskLevel(value: unknown): ModerationSummaryOutput["riskLevel"] | null {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return null;
}

function getRecommendedAction(
  value: unknown
): ModerationSummaryOutput["recommendedAction"] | null {
  if (
    value === "dismiss_or_monitor" ||
    value === "continue_review" ||
    value === "hide_listing" ||
    value === "hide_message" ||
    value === "restrict_profile" ||
    value === "escalate"
  ) {
    return value;
  }

  return null;
}

function parseOptionalNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

type AiModelRunLogInput = {
  input: ModerationSummaryInput;
  output?: ModerationSummaryOutput;
  providerName: string;
  modelName: string;
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
      modelName: run.modelName,
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

  return requireCreatedId(created, "AI model run creation");
}

async function recordModerationAiSummaryAuditEvent(
  app: FastifyInstance,
  input: {
    actorProfileId: string;
    caseId: string;
    targetType: string;
    targetId: string;
    aiModelRunId: string;
    modelName: string;
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
        modelName: input.modelName,
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

  return requireCreatedId(created, "AI moderation audit event creation");
}

function requireCreatedId(
  created: { id: string } | undefined,
  operation: string
): string {
  if (!created) {
    throw new Error(`${operation} did not return an id`);
  }

  return created.id;
}

function getPromptVersionForProvider(provider: ModerationSummaryProvider | undefined): string {
  if (provider?.providerName === "openai-responses") {
    return MODERATION_SUMMARY_OPENAI_PROMPT_VERSION;
  }

  if (provider?.providerName === "gemini-generate-content") {
    return MODERATION_SUMMARY_GEMINI_PROMPT_VERSION;
  }

  return MODERATION_SUMMARY_PROMPT_VERSION;
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

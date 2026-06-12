import {
  aiModelRuns,
  events,
  listings,
  messages,
  moderationActions,
  moderationCases,
  profiles,
  reports
} from "@babyloop/database/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  getAdminModerationCaseDetail,
  type AdminModerationCaseStatus,
  type AdminModerationTargetType
} from "./admin-moderation.service.js";
import { createSafeTextPreview } from "./redaction.service.js";
import {
  getOrRecomputeProfileTrustSnapshot,
  type AdminProfileTrustSnapshot
} from "./profile-trust-snapshot.service.js";

const AI_MODERATION_SUMMARY_FEATURE = "moderation_summary";
const OPEN_CASE_STATUSES: AdminModerationCaseStatus[] = ["pending", "in_review"];
const ENFORCEMENT_ACTION_TYPES = [
  "listing_hide",
  "listing_restore",
  "message_hide",
  "message_mark_reviewed",
  "profile_warn",
  "profile_restrict",
  "profile_suspend",
  "profile_restore"
];

export type AdminModerationCaseRiskLevel = "low" | "medium" | "high" | "critical";

export type AdminModerationCaseInsights = {
  caseId: string;
  generatedAt: string;
  targetProfile: {
    profileId: string;
    displayName: string;
    safetyStatus: "active" | "restricted" | "suspended";
    source: "target_profile" | "listing_seller" | "message_sender";
  } | null;
  counts: {
    openCasesForTarget: number;
    totalCasesForTarget: number;
    reportsLast7Days: number;
    reportsLast30Days: number;
    priorEnforcementActions: number;
    enforcementActionsLast30Days: number;
    sensitiveAccessEvents: number;
    aiSummaryRuns: number;
    aiSummarySuccesses: number;
    aiSummaryErrors: number;
  };
  latestAiSummary: {
    aiModelRunId: string;
    riskLevel: "low" | "medium" | "high" | null;
    recommendedAction: string | null;
    confidenceScore: number | null;
    createdAt: string;
  } | null;
  profileTrustSnapshot: AdminProfileTrustSnapshot | null;
  risk: {
    score: number;
    level: AdminModerationCaseRiskLevel;
    signals: string[];
  };
  recommendedNextStep: {
    code:
      | "review_ai_summary"
      | "review_sensitive_context"
      | "consider_enforcement"
      | "continue_review"
      | "monitor_only";
    label: string;
  };
};

export type AdminModerationCaseInsightsResult =
  | { status: "found"; caseId: string; insights: AdminModerationCaseInsights }
  | { status: "not_found" };

export async function getAdminModerationCaseInsights(
  app: FastifyInstance,
  caseId: string
): Promise<AdminModerationCaseInsightsResult> {
  const detail = await getAdminModerationCaseDetail(app, caseId);

  if (detail.status === "not_found") {
    return { status: "not_found" };
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    targetProfile,
    openCasesForTarget,
    totalCasesForTarget,
    reportsLast7Days,
    reportsLast30Days,
    priorEnforcementActions,
    enforcementActionsLast30Days,
    sensitiveAccessEvents,
    aiSummaryStats,
    latestAiSummary
  ] = await Promise.all([
    loadTargetProfileInsight(app, {
      targetType: detail.case.targetType,
      targetId: detail.case.targetId
    }),
    countCasesForTarget(app, {
      targetType: detail.case.targetType,
      targetId: detail.case.targetId,
      statuses: OPEN_CASE_STATUSES
    }),
    countCasesForTarget(app, {
      targetType: detail.case.targetType,
      targetId: detail.case.targetId
    }),
    countReportsForTargetSince(app, {
      targetType: detail.case.targetType,
      targetId: detail.case.targetId,
      since: sevenDaysAgo
    }),
    countReportsForTargetSince(app, {
      targetType: detail.case.targetType,
      targetId: detail.case.targetId,
      since: thirtyDaysAgo
    }),
    countEnforcementActionsForTarget(app, {
      targetType: detail.case.targetType,
      targetId: detail.case.targetId
    }),
    countEnforcementActionsForTarget(app, {
      targetType: detail.case.targetType,
      targetId: detail.case.targetId,
      since: thirtyDaysAgo
    }),
    countSensitiveAccessEventsForCase(app, caseId),
    countAiSummaryRunsForCase(app, caseId),
    loadLatestAiSummaryForCase(app, caseId)
  ]);

  const profileTrustSnapshot = targetProfile
    ? await getOrRecomputeProfileTrustSnapshot(app, targetProfile.profileId)
    : null;

  const counts = {
    openCasesForTarget,
    totalCasesForTarget,
    reportsLast7Days,
    reportsLast30Days,
    priorEnforcementActions,
    enforcementActionsLast30Days,
    sensitiveAccessEvents,
    aiSummaryRuns: aiSummaryStats.total,
    aiSummarySuccesses: aiSummaryStats.successes,
    aiSummaryErrors: aiSummaryStats.errors
  };

  const risk = calculateCaseRisk({
    priority: detail.case.priority,
    targetProfileSafetyStatus: targetProfile?.safetyStatus ?? null,
    latestAiRiskLevel: latestAiSummary?.riskLevel ?? null,
    counts
  });

  return {
    status: "found",
    caseId,
    insights: {
      caseId,
      generatedAt: now.toISOString(),
      targetProfile,
      counts,
      latestAiSummary,
      profileTrustSnapshot,
      risk,
      recommendedNextStep: getRecommendedNextStep({
        riskLevel: risk.level,
        latestAiSummary,
        counts,
        targetProfileSafetyStatus: targetProfile?.safetyStatus ?? null
      })
    }
  };
}

async function loadTargetProfileInsight(
  app: FastifyInstance,
  target: { targetType: AdminModerationTargetType; targetId: string }
): Promise<AdminModerationCaseInsights["targetProfile"]> {
  if (target.targetType === "profile") {
    return loadProfileInsight(app, target.targetId, "target_profile");
  }

  if (target.targetType === "listing") {
    const [listing] = await app.db
      .select({ sellerProfileId: listings.sellerProfileId })
      .from(listings)
      .where(eq(listings.id, target.targetId))
      .limit(1);

    return listing
      ? loadProfileInsight(app, listing.sellerProfileId, "listing_seller")
      : null;
  }

  const [message] = await app.db
    .select({ senderProfileId: messages.senderProfileId })
    .from(messages)
    .where(eq(messages.id, target.targetId))
    .limit(1);

  return message ? loadProfileInsight(app, message.senderProfileId, "message_sender") : null;
}

async function loadProfileInsight(
  app: FastifyInstance,
  profileId: string,
  source: NonNullable<AdminModerationCaseInsights["targetProfile"]>["source"]
): Promise<AdminModerationCaseInsights["targetProfile"]> {
  const [profile] = await app.db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      safetyStatus: profiles.safetyStatus
    })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile) {
    return null;
  }

  return {
    profileId: profile.id,
    displayName: createSafeTextPreview(profile.displayName, 80),
    safetyStatus: profile.safetyStatus,
    source
  };
}

async function countCasesForTarget(
  app: FastifyInstance,
  params: {
    targetType: AdminModerationTargetType;
    targetId: string;
    statuses?: AdminModerationCaseStatus[];
  }
): Promise<number> {
  const conditions = [
    eq(moderationCases.targetType, params.targetType),
    eq(moderationCases.targetId, params.targetId)
  ];

  if (params.statuses && params.statuses.length > 0) {
    conditions.push(inArray(moderationCases.status, params.statuses));
  }

  const [row] = await app.db
    .select({ count: sql<number>`count(*)` })
    .from(moderationCases)
    .where(and(...conditions));

  return Number(row?.count ?? 0);
}

async function countReportsForTargetSince(
  app: FastifyInstance,
  params: {
    targetType: AdminModerationTargetType;
    targetId: string;
    since: Date;
  }
): Promise<number> {
  const [row] = await app.db
    .select({ count: sql<number>`count(*)` })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, params.targetType),
        eq(reports.targetId, params.targetId),
        gte(reports.createdAt, params.since)
      )
    );

  return Number(row?.count ?? 0);
}

async function countEnforcementActionsForTarget(
  app: FastifyInstance,
  params: {
    targetType: AdminModerationTargetType;
    targetId: string;
    since?: Date;
  }
): Promise<number> {
  const conditions = [
    eq(moderationCases.targetType, params.targetType),
    eq(moderationCases.targetId, params.targetId),
    inArray(moderationActions.actionType, ENFORCEMENT_ACTION_TYPES)
  ];

  if (params.since) {
    conditions.push(gte(moderationActions.createdAt, params.since));
  }

  const [row] = await app.db
    .select({ count: sql<number>`count(*)` })
    .from(moderationActions)
    .innerJoin(moderationCases, eq(moderationActions.moderationCaseId, moderationCases.id))
    .where(and(...conditions));

  return Number(row?.count ?? 0);
}

async function countSensitiveAccessEventsForCase(
  app: FastifyInstance,
  caseId: string
): Promise<number> {
  const [row] = await app.db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(
      and(
        eq(events.entityType, "moderation_case"),
        eq(events.entityId, caseId),
        inArray(events.eventType, [
          "admin_sensitive_access_granted",
          "admin_sensitive_access_denied"
        ])
      )
    );

  return Number(row?.count ?? 0);
}

async function countAiSummaryRunsForCase(
  app: FastifyInstance,
  caseId: string
): Promise<{ total: number; successes: number; errors: number }> {
  const [row] = await app.db
    .select({
      total: sql<number>`count(*)`,
      successes: sql<number>`count(*) filter (where ${aiModelRuns.status} = 'success')`,
      errors: sql<number>`count(*) filter (where ${aiModelRuns.status} <> 'success')`
    })
    .from(aiModelRuns)
    .where(
      and(
        eq(aiModelRuns.feature, AI_MODERATION_SUMMARY_FEATURE),
        sql`${aiModelRuns.input}->>'caseId' = ${caseId}`
      )
    );

  return {
    total: Number(row?.total ?? 0),
    successes: Number(row?.successes ?? 0),
    errors: Number(row?.errors ?? 0)
  };
}

async function loadLatestAiSummaryForCase(
  app: FastifyInstance,
  caseId: string
): Promise<AdminModerationCaseInsights["latestAiSummary"]> {
  const [row] = await app.db
    .select({
      id: aiModelRuns.id,
      output: aiModelRuns.output,
      confidenceScore: aiModelRuns.confidenceScore,
      createdAt: aiModelRuns.createdAt
    })
    .from(aiModelRuns)
    .where(
      and(
        eq(aiModelRuns.feature, AI_MODERATION_SUMMARY_FEATURE),
        eq(aiModelRuns.status, "success"),
        sql`${aiModelRuns.input}->>'caseId' = ${caseId}`
      )
    )
    .orderBy(desc(aiModelRuns.createdAt))
    .limit(1);

  if (!row) {
    return null;
  }

  const output = row.output ?? {};

  return {
    aiModelRunId: row.id,
    riskLevel: getAiRiskLevel(output.riskLevel),
    recommendedAction: getOptionalString(output.recommendedAction, 80),
    confidenceScore: parseOptionalNumber(row.confidenceScore),
    createdAt: row.createdAt.toISOString()
  };
}

function calculateCaseRisk(input: {
  priority: "low" | "normal" | "high";
  targetProfileSafetyStatus: "active" | "restricted" | "suspended" | null;
  latestAiRiskLevel: "low" | "medium" | "high" | null;
  counts: AdminModerationCaseInsights["counts"];
}): AdminModerationCaseInsights["risk"] {
  let score = 0;
  const signals: string[] = [];

  if (input.priority === "high") {
    score += 20;
    signals.push("High-priority case");
  } else if (input.priority === "normal") {
    score += 8;
  }

  if (input.counts.openCasesForTarget > 1) {
    score += Math.min(25, input.counts.openCasesForTarget * 8);
    signals.push("Multiple open cases for this target");
  }

  if (input.counts.reportsLast30Days > 0) {
    score += Math.min(24, input.counts.reportsLast30Days * 8);
    signals.push("Recent reports for this target");
  }

  if (input.counts.enforcementActionsLast30Days > 0) {
    score += Math.min(25, input.counts.enforcementActionsLast30Days * 12);
    signals.push("Recent enforcement history");
  }

  if (input.counts.sensitiveAccessEvents > 0) {
    score += 5;
    signals.push("Sensitive context was requested for this case");
  }

  if (input.latestAiRiskLevel === "high") {
    score += 20;
    signals.push("Latest AI summary marked high risk");
  } else if (input.latestAiRiskLevel === "medium") {
    score += 10;
    signals.push("Latest AI summary marked medium risk");
  }

  if (input.targetProfileSafetyStatus === "suspended") {
    score += 35;
    signals.push("Target profile is suspended");
  } else if (input.targetProfileSafetyStatus === "restricted") {
    score += 20;
    signals.push("Target profile is restricted");
  }

  const normalizedScore = Math.max(0, Math.min(100, score));

  return {
    score: normalizedScore,
    level: riskLevelForScore(normalizedScore),
    signals: signals.length > 0 ? signals : ["No elevated risk signals in current safe metadata"]
  };
}

function riskLevelForScore(score: number): AdminModerationCaseRiskLevel {
  if (score >= 75) {
    return "critical";
  }

  if (score >= 50) {
    return "high";
  }

  if (score >= 25) {
    return "medium";
  }

  return "low";
}

function getRecommendedNextStep(input: {
  riskLevel: AdminModerationCaseRiskLevel;
  latestAiSummary: AdminModerationCaseInsights["latestAiSummary"];
  counts: AdminModerationCaseInsights["counts"];
  targetProfileSafetyStatus: "active" | "restricted" | "suspended" | null;
}): AdminModerationCaseInsights["recommendedNextStep"] {
  if (!input.latestAiSummary) {
    return {
      code: "review_ai_summary",
      label: "Generate or review an AI summary before deciding."
    };
  }

  if (input.riskLevel === "critical" || input.riskLevel === "high") {
    return {
      code: "consider_enforcement",
      label: "Review enforcement options and prior history before closing this case."
    };
  }

  if (input.counts.sensitiveAccessEvents === 0 && input.riskLevel === "medium") {
    return {
      code: "review_sensitive_context",
      label: "Consider whether sensitive context is necessary before applying enforcement."
    };
  }

  if (input.targetProfileSafetyStatus === "restricted" || input.targetProfileSafetyStatus === "suspended") {
    return {
      code: "monitor_only",
      label: "Existing profile enforcement is already active; verify whether monitoring is enough."
    };
  }

  return {
    code: "continue_review",
    label: "Continue review using timeline, AI history, and enforcement context."
  };
}

function getAiRiskLevel(value: unknown): "low" | "medium" | "high" | null {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return null;
}

function getOptionalString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim()
    ? value.slice(0, maxLength)
    : null;
}

function parseOptionalNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

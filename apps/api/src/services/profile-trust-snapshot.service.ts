import {
  aiModelRuns,
  events,
  listings,
  messages,
  moderationActions,
  moderationCases,
  profileTrustSnapshots,
  profiles,
  reports
} from "@babyloop/database/schema";
import { and, desc, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

const AI_MODERATION_SUMMARY_FEATURE = "moderation_summary";
const OPEN_CASE_STATUSES = ["pending", "in_review"] as const;
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
const SENSITIVE_ACCESS_EVENT_TYPES = [
  "admin_sensitive_access_granted",
  "admin_sensitive_access_denied"
];

export type ProfileTrustRiskLevel = "low" | "medium" | "high" | "critical";

export type AdminProfileTrustSnapshot = {
  profileId: string;
  trustScore: number;
  riskScore: number;
  riskLevel: ProfileTrustRiskLevel;
  safetyStatus: "active" | "restricted" | "suspended";
  openCaseCount: number;
  totalCaseCount: number;
  recentReportCount: number;
  recentEnforcementCount: number;
  sensitiveAccessCount: number;
  aiSummaryCount: number;
  lastReportAt: string | null;
  lastEnforcementAt: string | null;
  computedAt: string;
};

type RelatedTargetIds = {
  listingIds: string[];
  messageIds: string[];
};

type ProfileTrustSnapshotComputation = {
  profileId: string;
  safetyStatus: "active" | "restricted" | "suspended";
  openCaseCount: number;
  totalCaseCount: number;
  recentReportCount: number;
  recentEnforcementCount: number;
  sensitiveAccessCount: number;
  aiSummaryCount: number;
  lastReportAt: Date | null;
  lastEnforcementAt: Date | null;
  computedAt: Date;
  trustScore: number;
  riskScore: number;
  riskLevel: ProfileTrustRiskLevel;
};

export async function getProfileTrustSnapshot(
  app: FastifyInstance,
  profileId: string
): Promise<AdminProfileTrustSnapshot | null> {
  const [snapshot] = await app.db
    .select({
      profileId: profileTrustSnapshots.profileId,
      trustScore: profileTrustSnapshots.trustScore,
      riskScore: profileTrustSnapshots.riskScore,
      riskLevel: profileTrustSnapshots.riskLevel,
      safetyStatus: profileTrustSnapshots.safetyStatus,
      openCaseCount: profileTrustSnapshots.openCaseCount,
      totalCaseCount: profileTrustSnapshots.totalCaseCount,
      recentReportCount: profileTrustSnapshots.recentReportCount,
      recentEnforcementCount: profileTrustSnapshots.recentEnforcementCount,
      sensitiveAccessCount: profileTrustSnapshots.sensitiveAccessCount,
      aiSummaryCount: profileTrustSnapshots.aiSummaryCount,
      lastReportAt: profileTrustSnapshots.lastReportAt,
      lastEnforcementAt: profileTrustSnapshots.lastEnforcementAt,
      computedAt: profileTrustSnapshots.computedAt
    })
    .from(profileTrustSnapshots)
    .where(eq(profileTrustSnapshots.profileId, profileId))
    .limit(1);

  return snapshot ? toAdminProfileTrustSnapshot(snapshot) : null;
}

export async function getOrRecomputeProfileTrustSnapshot(
  app: FastifyInstance,
  profileId: string
): Promise<AdminProfileTrustSnapshot | null> {
  const computed = await computeProfileTrustSnapshot(app, profileId);

  if (!computed) {
    return null;
  }

  return upsertProfileTrustSnapshot(app, computed);
}

export async function recomputeProfileTrustSnapshot(
  app: FastifyInstance,
  profileId: string
): Promise<AdminProfileTrustSnapshot | null> {
  return getOrRecomputeProfileTrustSnapshot(app, profileId);
}

async function computeProfileTrustSnapshot(
  app: FastifyInstance,
  profileId: string
): Promise<ProfileTrustSnapshotComputation | null> {
  const [profile] = await app.db
    .select({ id: profiles.id, safetyStatus: profiles.safetyStatus })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile) {
    return null;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const relatedTargetIds = await loadRelatedTargetIds(app, profileId);
  const relatedCaseIds = await loadRelatedCaseIds(app, profileId, relatedTargetIds);

  const [
    openCaseCount,
    totalCaseCount,
    recentReportCount,
    recentEnforcementCount,
    sensitiveAccessCount,
    aiSummaryCount,
    lastReportAt,
    lastEnforcementAt
  ] = await Promise.all([
    countModerationCasesForProfile(app, profileId, relatedTargetIds, {
      statuses: [...OPEN_CASE_STATUSES]
    }),
    countModerationCasesForProfile(app, profileId, relatedTargetIds),
    countReportsForProfile(app, profileId, relatedTargetIds, { since: thirtyDaysAgo }),
    countEnforcementActionsForProfile(app, profileId, relatedTargetIds, { since: thirtyDaysAgo }),
    countSensitiveAccessEventsForCases(app, relatedCaseIds),
    countAiSummaryRunsForCases(app, relatedCaseIds),
    loadLastReportAtForProfile(app, profileId, relatedTargetIds),
    loadLastEnforcementAtForProfile(app, profileId, relatedTargetIds)
  ]);

  const risk = calculateProfileRiskScore({
    aiSummaryCount,
    openCaseCount,
    recentEnforcementCount,
    recentReportCount,
    safetyStatus: profile.safetyStatus,
    sensitiveAccessCount,
    totalCaseCount
  });

  return {
    profileId: profile.id,
    safetyStatus: profile.safetyStatus,
    openCaseCount,
    totalCaseCount,
    recentReportCount,
    recentEnforcementCount,
    sensitiveAccessCount,
    aiSummaryCount,
    lastReportAt,
    lastEnforcementAt,
    computedAt: now,
    trustScore: 100 - risk.score,
    riskScore: risk.score,
    riskLevel: risk.level
  };
}

async function upsertProfileTrustSnapshot(
  app: FastifyInstance,
  snapshot: ProfileTrustSnapshotComputation
): Promise<AdminProfileTrustSnapshot> {
  const values = {
    profileId: snapshot.profileId,
    trustScore: snapshot.trustScore,
    riskScore: snapshot.riskScore,
    riskLevel: snapshot.riskLevel,
    safetyStatus: snapshot.safetyStatus,
    openCaseCount: snapshot.openCaseCount,
    totalCaseCount: snapshot.totalCaseCount,
    recentReportCount: snapshot.recentReportCount,
    recentEnforcementCount: snapshot.recentEnforcementCount,
    sensitiveAccessCount: snapshot.sensitiveAccessCount,
    aiSummaryCount: snapshot.aiSummaryCount,
    lastReportAt: snapshot.lastReportAt,
    lastEnforcementAt: snapshot.lastEnforcementAt,
    computedAt: snapshot.computedAt,
    updatedAt: new Date()
  };

  const [created] = await app.db
    .insert(profileTrustSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: profileTrustSnapshots.profileId,
      set: values
    })
    .returning({
      profileId: profileTrustSnapshots.profileId,
      trustScore: profileTrustSnapshots.trustScore,
      riskScore: profileTrustSnapshots.riskScore,
      riskLevel: profileTrustSnapshots.riskLevel,
      safetyStatus: profileTrustSnapshots.safetyStatus,
      openCaseCount: profileTrustSnapshots.openCaseCount,
      totalCaseCount: profileTrustSnapshots.totalCaseCount,
      recentReportCount: profileTrustSnapshots.recentReportCount,
      recentEnforcementCount: profileTrustSnapshots.recentEnforcementCount,
      sensitiveAccessCount: profileTrustSnapshots.sensitiveAccessCount,
      aiSummaryCount: profileTrustSnapshots.aiSummaryCount,
      lastReportAt: profileTrustSnapshots.lastReportAt,
      lastEnforcementAt: profileTrustSnapshots.lastEnforcementAt,
      computedAt: profileTrustSnapshots.computedAt
    });

  if (!created) {
    throw new Error("Profile trust snapshot upsert did not return a row.");
  }

  return toAdminProfileTrustSnapshot(created);
}

async function loadRelatedTargetIds(
  app: FastifyInstance,
  profileId: string
): Promise<RelatedTargetIds> {
  const [listingRows, messageRows] = await Promise.all([
    app.db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.sellerProfileId, profileId)),
    app.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.senderProfileId, profileId))
  ]);

  return {
    listingIds: listingRows.map((row) => row.id),
    messageIds: messageRows.map((row) => row.id)
  };
}

async function loadRelatedCaseIds(
  app: FastifyInstance,
  profileId: string,
  relatedTargetIds: RelatedTargetIds
): Promise<string[]> {
  const whereClause = buildModerationCaseProfileWhere(profileId, relatedTargetIds);

  const rows = await app.db
    .select({ id: moderationCases.id })
    .from(moderationCases)
    .where(whereClause)
    .orderBy(desc(moderationCases.createdAt));

  return rows.map((row) => row.id);
}

async function countModerationCasesForProfile(
  app: FastifyInstance,
  profileId: string,
  relatedTargetIds: RelatedTargetIds,
  options: { statuses?: Array<(typeof OPEN_CASE_STATUSES)[number]> } = {}
): Promise<number> {
  const conditions = [buildModerationCaseProfileWhere(profileId, relatedTargetIds)];

  if (options.statuses && options.statuses.length > 0) {
    conditions.push(inArray(moderationCases.status, options.statuses));
  }

  const [row] = await app.db
    .select({ count: sql<number>`count(*)::int` })
    .from(moderationCases)
    .where(and(...conditions));

  return row?.count ?? 0;
}

async function countReportsForProfile(
  app: FastifyInstance,
  profileId: string,
  relatedTargetIds: RelatedTargetIds,
  options: { since?: Date } = {}
): Promise<number> {
  const conditions = [buildReportProfileWhere(profileId, relatedTargetIds)];

  if (options.since) {
    conditions.push(gte(reports.createdAt, options.since));
  }

  const [row] = await app.db
    .select({ count: sql<number>`count(*)::int` })
    .from(reports)
    .where(and(...conditions));

  return row?.count ?? 0;
}

async function countEnforcementActionsForProfile(
  app: FastifyInstance,
  profileId: string,
  relatedTargetIds: RelatedTargetIds,
  options: { since?: Date } = {}
): Promise<number> {
  const caseConditions = [
    buildModerationCaseProfileWhere(profileId, relatedTargetIds),
    inArray(moderationActions.actionType, ENFORCEMENT_ACTION_TYPES)
  ];

  if (options.since) {
    caseConditions.push(gte(moderationActions.createdAt, options.since));
  }

  const directConditions = [
    eq(events.entityType, "profile"),
    eq(events.entityId, profileId),
    eq(events.eventType, "admin_profile_enforcement_applied")
  ];

  if (options.since) {
    directConditions.push(gte(events.createdAt, options.since));
  }

  const [caseRow, directRow] = await Promise.all([
    app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(moderationActions)
      .innerJoin(moderationCases, eq(moderationActions.moderationCaseId, moderationCases.id))
      .where(and(...caseConditions)),
    app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(and(...directConditions))
  ]);

  return (caseRow[0]?.count ?? 0) + (directRow[0]?.count ?? 0);
}

async function countSensitiveAccessEventsForCases(
  app: FastifyInstance,
  caseIds: string[]
): Promise<number> {
  if (caseIds.length === 0) {
    return 0;
  }

  const [row] = await app.db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.entityType, "moderation_case"),
        inArray(events.entityId, caseIds),
        inArray(events.eventType, SENSITIVE_ACCESS_EVENT_TYPES)
      )
    );

  return row?.count ?? 0;
}

async function countAiSummaryRunsForCases(
  app: FastifyInstance,
  caseIds: string[]
): Promise<number> {
  if (caseIds.length === 0) {
    return 0;
  }

  const [row] = await app.db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiModelRuns)
    .where(
      and(
        eq(aiModelRuns.feature, AI_MODERATION_SUMMARY_FEATURE),
        inArray(sql<string>`${aiModelRuns.input}->>'caseId'`, caseIds)
      )
    );

  return row?.count ?? 0;
}

async function loadLastReportAtForProfile(
  app: FastifyInstance,
  profileId: string,
  relatedTargetIds: RelatedTargetIds
): Promise<Date | null> {
  const [row] = await app.db
    .select({ lastAt: sql<Date | null>`max(${reports.createdAt})` })
    .from(reports)
    .where(buildReportProfileWhere(profileId, relatedTargetIds));

  return row?.lastAt ?? null;
}

async function loadLastEnforcementAtForProfile(
  app: FastifyInstance,
  profileId: string,
  relatedTargetIds: RelatedTargetIds
): Promise<Date | null> {
  const [caseRows, directRows] = await Promise.all([
    app.db
      .select({ lastAt: sql<Date | null>`max(${moderationActions.createdAt})` })
      .from(moderationActions)
      .innerJoin(moderationCases, eq(moderationActions.moderationCaseId, moderationCases.id))
      .where(
        and(
          buildModerationCaseProfileWhere(profileId, relatedTargetIds),
          inArray(moderationActions.actionType, ENFORCEMENT_ACTION_TYPES)
        )
      ),
    app.db
      .select({ lastAt: sql<Date | null>`max(${events.createdAt})` })
      .from(events)
      .where(
        and(
          eq(events.entityType, "profile"),
          eq(events.entityId, profileId),
          eq(events.eventType, "admin_profile_enforcement_applied")
        )
      )
  ]);

  const caseLastAt = caseRows[0]?.lastAt ?? null;
  const directLastAt = directRows[0]?.lastAt ?? null;

  if (!caseLastAt) {
    return directLastAt;
  }

  if (!directLastAt) {
    return caseLastAt;
  }

  return caseLastAt > directLastAt ? caseLastAt : directLastAt;
}

function buildModerationCaseProfileWhere(
  profileId: string,
  relatedTargetIds: RelatedTargetIds
): SQL {
  const conditions: SQL[] = [
    and(eq(moderationCases.targetType, "profile"), eq(moderationCases.targetId, profileId))!
  ];

  if (relatedTargetIds.listingIds.length > 0) {
    conditions.push(
      and(
        eq(moderationCases.targetType, "listing"),
        inArray(moderationCases.targetId, relatedTargetIds.listingIds)
      )!
    );
  }

  if (relatedTargetIds.messageIds.length > 0) {
    conditions.push(
      and(
        eq(moderationCases.targetType, "message"),
        inArray(moderationCases.targetId, relatedTargetIds.messageIds)
      )!
    );
  }

  return or(...conditions)!;
}

function buildReportProfileWhere(profileId: string, relatedTargetIds: RelatedTargetIds): SQL {
  const conditions: SQL[] = [
    and(eq(reports.targetType, "profile"), eq(reports.targetId, profileId))!
  ];

  if (relatedTargetIds.listingIds.length > 0) {
    conditions.push(
      and(eq(reports.targetType, "listing"), inArray(reports.targetId, relatedTargetIds.listingIds))!
    );
  }

  if (relatedTargetIds.messageIds.length > 0) {
    conditions.push(
      and(eq(reports.targetType, "message"), inArray(reports.targetId, relatedTargetIds.messageIds))!
    );
  }

  return or(...conditions)!;
}

function calculateProfileRiskScore(input: {
  aiSummaryCount: number;
  openCaseCount: number;
  recentEnforcementCount: number;
  recentReportCount: number;
  safetyStatus: "active" | "restricted" | "suspended";
  sensitiveAccessCount: number;
  totalCaseCount: number;
}): { score: number; level: ProfileTrustRiskLevel } {
  let score = 0;

  if (input.safetyStatus === "suspended") {
    score += 60;
  } else if (input.safetyStatus === "restricted") {
    score += 35;
  }

  score += Math.min(30, input.openCaseCount * 10);
  score += Math.min(25, input.recentReportCount * 8);
  score += Math.min(30, input.recentEnforcementCount * 12);
  score += Math.min(10, input.sensitiveAccessCount * 3);
  score += Math.min(10, input.totalCaseCount * 2);
  score += Math.min(5, input.aiSummaryCount);

  const normalized = Math.max(0, Math.min(100, score));

  return {
    score: normalized,
    level: profileRiskLevelForScore(normalized)
  };
}

function profileRiskLevelForScore(score: number): ProfileTrustRiskLevel {
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

function toAdminProfileTrustSnapshot(row: {
  profileId: string;
  trustScore: number;
  riskScore: number;
  riskLevel: ProfileTrustRiskLevel;
  safetyStatus: "active" | "restricted" | "suspended";
  openCaseCount: number;
  totalCaseCount: number;
  recentReportCount: number;
  recentEnforcementCount: number;
  sensitiveAccessCount: number;
  aiSummaryCount: number;
  lastReportAt: Date | null;
  lastEnforcementAt: Date | null;
  computedAt: Date;
}): AdminProfileTrustSnapshot {
  return {
    profileId: row.profileId,
    trustScore: row.trustScore,
    riskScore: row.riskScore,
    riskLevel: row.riskLevel,
    safetyStatus: row.safetyStatus,
    openCaseCount: row.openCaseCount,
    totalCaseCount: row.totalCaseCount,
    recentReportCount: row.recentReportCount,
    recentEnforcementCount: row.recentEnforcementCount,
    sensitiveAccessCount: row.sensitiveAccessCount,
    aiSummaryCount: row.aiSummaryCount,
    lastReportAt: row.lastReportAt ? row.lastReportAt.toISOString() : null,
    lastEnforcementAt: row.lastEnforcementAt ? row.lastEnforcementAt.toISOString() : null,
    computedAt: row.computedAt.toISOString()
  };
}

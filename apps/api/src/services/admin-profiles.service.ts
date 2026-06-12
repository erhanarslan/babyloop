import {
  listings,
  moderationActions,
  moderationCases,
  productCategories,
  profileTrustSnapshots,
  profiles,
  reports
} from "@babyloop/database/schema";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type {
  AdminProfileRiskLevelValue,
  AdminProfileSafetyStatusValue,
  AdminProfilesQuery
} from "../schemas/admin-profiles.schemas.js";
import type { AdminProfileTrustSnapshot } from "./profile-trust-snapshot.service.js";

export type AdminProfileSummary = {
  profileId: string;
  displayName: string;
  locationCity: string | null;
  safetyStatus: AdminProfileSafetyStatusValue;
  createdAt: string;
  updatedAt: string;
  listingCount: number;
  trustSnapshot: AdminProfileTrustSnapshot | null;
};

export type AdminProfileListingSummary = {
  listingId: string;
  title: string;
  status: string;
  listingType: string;
  condition: string;
  price: {
    amount: string;
    currency: string;
  } | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type AdminProfileModerationCaseSummary = {
  caseId: string;
  reportId: string | null;
  targetType: "listing" | "profile" | "message";
  targetId: string;
  status: "pending" | "in_review" | "resolved" | "dismissed";
  priority: "low" | "normal" | "high";
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminProfileEnforcementSummary = {
  actionId: string;
  caseId: string | null;
  actionType: string;
  createdAt: string;
};

export type AdminProfileDetail = AdminProfileSummary & {
  stats: {
    totalListings: number;
    activeListings: number;
    archivedListings: number;
    soldListings: number;
    reservedListings: number;
    draftListings: number;
    totalCases: number;
    openCases: number;
    enforcementActions: number;
  };
  listings: AdminProfileListingSummary[];
  relatedModerationCases: AdminProfileModerationCaseSummary[];
  enforcementHistory: AdminProfileEnforcementSummary[];
};

type AdminProfileRow = {
  profileId: string;
  displayName: string;
  locationCity: string | null;
  safetyStatus: AdminProfileSafetyStatusValue;
  createdAt: Date;
  updatedAt: Date;
  snapshotProfileId: string | null;
  trustScore: number | null;
  riskScore: number | null;
  riskLevel: AdminProfileRiskLevelValue | null;
  snapshotSafetyStatus: AdminProfileSafetyStatusValue | null;
  openCaseCount: number | null;
  totalCaseCount: number | null;
  recentReportCount: number | null;
  recentEnforcementCount: number | null;
  sensitiveAccessCount: number | null;
  aiSummaryCount: number | null;
  lastReportAt: Date | null;
  lastEnforcementAt: Date | null;
  computedAt: Date | null;
};

export async function listAdminProfiles(
  app: FastifyInstance,
  filters: AdminProfilesQuery
): Promise<AdminProfileSummary[]> {
  const limit = filters.limit ?? 50;
  const rows = await selectAdminProfileRows(app, filters, limit);
  const listingCounts = await loadListingCountsByProfileId(app, rows.map((row) => row.profileId));

  return rows.map((row) => toAdminProfileSummary(row, listingCounts.get(row.profileId) ?? 0));
}

export async function getAdminProfileDetail(
  app: FastifyInstance,
  profileId: string
): Promise<AdminProfileDetail | null> {
  const [row] = await selectAdminProfileRows(app, { q: profileId }, 1);

  if (!row || row.profileId !== profileId) {
    return null;
  }

  const [listingCounts, recentListings] = await Promise.all([
    loadListingStatusCounts(app, profileId),
    loadRecentProfileListings(app, profileId)
  ]);
  const listingIds = recentListings.map((listing) => listing.listingId);
  const relatedCases = await loadRelatedModerationCases(app, { profileId, listingIds });
  const enforcementHistory = await loadEnforcementHistory(app, relatedCases.map((item) => item.caseId));
  const summary = toAdminProfileSummary(row, listingCounts.totalListings);

  return {
    ...summary,
    stats: {
      totalListings: listingCounts.totalListings,
      activeListings: listingCounts.activeListings,
      archivedListings: listingCounts.archivedListings,
      soldListings: listingCounts.soldListings,
      reservedListings: listingCounts.reservedListings,
      draftListings: listingCounts.draftListings,
      totalCases: relatedCases.length,
      openCases: relatedCases.filter((item) => item.status === "pending" || item.status === "in_review").length,
      enforcementActions: enforcementHistory.length
    },
    listings: recentListings,
    relatedModerationCases: relatedCases,
    enforcementHistory
  };
}

async function selectAdminProfileRows(
  app: FastifyInstance,
  filters: AdminProfilesQuery,
  limit: number
): Promise<AdminProfileRow[]> {
  const conditions = buildAdminProfileConditions(filters);
  const query = app.db
    .select({
      profileId: profiles.id,
      displayName: profiles.displayName,
      locationCity: profiles.locationCity,
      safetyStatus: profiles.safetyStatus,
      createdAt: profiles.createdAt,
      updatedAt: profiles.updatedAt,
      snapshotProfileId: profileTrustSnapshots.profileId,
      trustScore: profileTrustSnapshots.trustScore,
      riskScore: profileTrustSnapshots.riskScore,
      riskLevel: profileTrustSnapshots.riskLevel,
      snapshotSafetyStatus: profileTrustSnapshots.safetyStatus,
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
    .from(profiles)
    .leftJoin(profileTrustSnapshots, eq(profileTrustSnapshots.profileId, profiles.id))
    .where(conditions)
    .orderBy(...getAdminProfileOrderBy(filters.sort))
    .limit(limit);

  return query;
}

function buildAdminProfileConditions(filters: AdminProfilesQuery): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.safetyStatus) {
    conditions.push(eq(profiles.safetyStatus, filters.safetyStatus));
  }

  if (filters.riskLevel) {
    conditions.push(eq(profileTrustSnapshots.riskLevel, filters.riskLevel));
  }

  if (filters.q) {
    const query = `%${escapeLike(filters.q)}%`;
    conditions.push(
      or(
        ilike(profiles.displayName, query),
        ilike(profiles.locationCity, query),
        ilike(sql<string>`${profiles.id}::text`, query)
      )!
    );
  }

  return conditions.length > 0 ? sql.join(conditions, sql` and `) : undefined;
}

function getAdminProfileOrderBy(sort: AdminProfilesQuery["sort"]): SQL[] {
  switch (sort ?? "risk_desc") {
    case "risk_asc":
      return [asc(sql`coalesce(${profileTrustSnapshots.riskScore}, 0)`), desc(profiles.createdAt)];
    case "trust_desc":
      return [desc(sql`coalesce(${profileTrustSnapshots.trustScore}, 100)`), desc(profiles.createdAt)];
    case "trust_asc":
      return [asc(sql`coalesce(${profileTrustSnapshots.trustScore}, 100)`), desc(profiles.createdAt)];
    case "newest":
      return [desc(profiles.createdAt)];
    case "oldest":
      return [asc(profiles.createdAt)];
    case "risk_desc":
    default:
      return [desc(sql`coalesce(${profileTrustSnapshots.riskScore}, 0)`), desc(profiles.createdAt)];
  }
}

async function loadListingCountsByProfileId(
  app: FastifyInstance,
  profileIds: string[]
): Promise<Map<string, number>> {
  if (profileIds.length === 0) {
    return new Map();
  }

  const rows = await app.db
    .select({
      profileId: listings.sellerProfileId,
      listingCount: sql<number>`count(${listings.id})::int`
    })
    .from(listings)
    .where(inArray(listings.sellerProfileId, profileIds))
    .groupBy(listings.sellerProfileId);

  return new Map(rows.map((row) => [row.profileId, row.listingCount]));
}

async function loadListingStatusCounts(
  app: FastifyInstance,
  profileId: string
): Promise<AdminProfileDetail["stats"]> {
  const rows = await app.db
    .select({
      status: listings.status,
      count: sql<number>`count(${listings.id})::int`
    })
    .from(listings)
    .where(eq(listings.sellerProfileId, profileId))
    .groupBy(listings.status);

  const counts = new Map(rows.map((row) => [row.status, row.count]));

  return {
    totalListings: rows.reduce((total, row) => total + row.count, 0),
    activeListings: counts.get("active") ?? 0,
    archivedListings: counts.get("archived") ?? 0,
    soldListings: counts.get("sold") ?? 0,
    reservedListings: counts.get("reserved") ?? 0,
    draftListings: counts.get("draft") ?? 0,
    totalCases: 0,
    openCases: 0,
    enforcementActions: 0
  };
}

async function loadRecentProfileListings(
  app: FastifyInstance,
  profileId: string
): Promise<AdminProfileListingSummary[]> {
  const rows = await app.db
    .select({
      listingId: listings.id,
      title: listings.title,
      status: listings.status,
      listingType: listings.listingType,
      condition: listings.condition,
      priceAmount: listings.priceAmount,
      currency: listings.currency,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      categorySlug: productCategories.slug,
      createdAt: listings.createdAt,
      updatedAt: listings.updatedAt
    })
    .from(listings)
    .innerJoin(productCategories, eq(productCategories.id, listings.categoryId))
    .where(eq(listings.sellerProfileId, profileId))
    .orderBy(desc(listings.updatedAt))
    .limit(10);

  return rows.map((row) => ({
    listingId: row.listingId,
    title: row.title,
    status: row.status,
    listingType: row.listingType,
    condition: row.condition,
    price: row.priceAmount
      ? {
          amount: row.priceAmount,
          currency: row.currency
        }
      : null,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

async function loadRelatedModerationCases(
  app: FastifyInstance,
  params: { profileId: string; listingIds: string[] }
): Promise<AdminProfileModerationCaseSummary[]> {
  const targetConditions: SQL[] = [
    and(eq(moderationCases.targetType, "profile"), eq(moderationCases.targetId, params.profileId))!
  ];

  if (params.listingIds.length > 0) {
    targetConditions.push(
      and(eq(moderationCases.targetType, "listing"), inArray(moderationCases.targetId, params.listingIds))!
    );
  }

  const rows = await app.db
    .select({
      caseId: moderationCases.id,
      reportId: moderationCases.reportId,
      targetType: moderationCases.targetType,
      targetId: moderationCases.targetId,
      status: moderationCases.status,
      priority: moderationCases.priority,
      reason: reports.reason,
      createdAt: moderationCases.createdAt,
      updatedAt: moderationCases.updatedAt
    })
    .from(moderationCases)
    .leftJoin(reports, eq(reports.id, moderationCases.reportId))
    .where(sql.join(targetConditions, sql` or `))
    .orderBy(desc(moderationCases.updatedAt))
    .limit(20);

  return rows.map((row) => ({
    caseId: row.caseId,
    reportId: row.reportId,
    targetType: row.targetType,
    targetId: row.targetId,
    status: row.status,
    priority: row.priority,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

async function loadEnforcementHistory(
  app: FastifyInstance,
  caseIds: string[]
): Promise<AdminProfileEnforcementSummary[]> {
  if (caseIds.length === 0) {
    return [];
  }

  const rows = await app.db
    .select({
      actionId: moderationActions.id,
      caseId: moderationActions.moderationCaseId,
      actionType: moderationActions.actionType,
      createdAt: moderationActions.createdAt
    })
    .from(moderationActions)
    .where(inArray(moderationActions.moderationCaseId, caseIds))
    .orderBy(desc(moderationActions.createdAt))
    .limit(20);

  return rows.map((row) => ({
    actionId: row.actionId,
    caseId: row.caseId,
    actionType: row.actionType,
    createdAt: row.createdAt.toISOString()
  }));
}

function toAdminProfileSummary(row: AdminProfileRow, listingCount: number): AdminProfileSummary {
  return {
    profileId: row.profileId,
    displayName: row.displayName,
    locationCity: row.locationCity,
    safetyStatus: row.safetyStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    listingCount,
    trustSnapshot: row.snapshotProfileId && row.computedAt
      ? {
          profileId: row.snapshotProfileId,
          trustScore: row.trustScore ?? 100,
          riskScore: row.riskScore ?? 0,
          riskLevel: row.riskLevel ?? "low",
          safetyStatus: row.snapshotSafetyStatus ?? row.safetyStatus,
          openCaseCount: row.openCaseCount ?? 0,
          totalCaseCount: row.totalCaseCount ?? 0,
          recentReportCount: row.recentReportCount ?? 0,
          recentEnforcementCount: row.recentEnforcementCount ?? 0,
          sensitiveAccessCount: row.sensitiveAccessCount ?? 0,
          aiSummaryCount: row.aiSummaryCount ?? 0,
          lastReportAt: row.lastReportAt?.toISOString() ?? null,
          lastEnforcementAt: row.lastEnforcementAt?.toISOString() ?? null,
          computedAt: row.computedAt.toISOString()
        }
      : null
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

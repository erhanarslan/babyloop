import {
  listings,
  profileTrustSnapshots,
  profiles
} from "@babyloop/database/schema";
import { asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
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

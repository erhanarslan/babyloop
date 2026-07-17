import {
  analyticsDailyAuth,
  analyticsDailyCategories,
  analyticsDailyOverview,
  analyticsDailyPages,
  analyticsEvents,
  authAccounts,
  productCategories,
  users
} from "@babyloop/database/schema";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { FastifyInstance } from "fastify";

export type AdminAnalyticsQuery = {
  from?: string;
  to?: string;
  platform?: "web" | "mobile";
};

export type AdminAnalyticsOverview = {
  totalRegisteredUsers: number;
  verifiedUsers: number;
  verifiedRate: number;
  googleLinkedUsers: number;
  googleLinkedRate: number;
  passwordUsers: number;
  dau: number;
  activeUsers: number;
  sessions: number;
  averageSessionEngagementMs: number;
  pageViews: number;
  screenViews: number;
  listingViews: number;
  uniqueListingViewers: number;
  favoriteUsers: number;
  chatUsers: number;
  messageSenders: number;
  conversationsStarted: number;
  assistantUsers: number;
  checkoutUsers: number;
  lastRollupAt: string | null;
};

export type AdminAnalyticsPageRow = {
  surface: string;
  platform: string;
  views: number;
  uniqueUsers: number;
  uniqueSessions: number;
  averageEngagementMs: number;
  p50EngagementMs: number;
  p90EngagementMs: number;
  exits: number;
};

export type AdminAnalyticsCategoryRow = {
  categoryId: string;
  categoryName: string;
  platform: string;
  impressions: number;
  listingViews: number;
  uniqueViewers: number;
  favorites: number;
  conversationsStarted: number;
  cartAdds: number;
  checkoutCompleted: number;
};

export type AdminAnalyticsAuthRow = {
  platform: string;
  authProvider: string;
  registrations: number;
  successfulLogins: number;
  failedLogins: number;
  emailVerifications: number;
  mfaCompletions: number;
  approvalCompletions: number;
};

export type AdminAnalyticsDataQuality = {
  duplicateEventsLast7Days: number;
  rejectedEventsLast7Days: number;
  missingSessionIdsLast7Days: number;
  unknownEventVersionsLast7Days: number;
  rawEventsLast7Days: number;
};

export async function getAdminAnalyticsOverview(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsOverview> {
  const range = normalizeAnalyticsRange(query);
  const dailyWhere = buildDailyWhere(query, range);

  const [userSnapshot, googleSnapshot, passwordSnapshot, daily] = await Promise.all([
    getUserSnapshot(app),
    getProviderSnapshot(app, "google"),
    getProviderSnapshot(app, "password"),
    app.db
      .select({
        activeUsers: sql<number>`coalesce(sum(${analyticsDailyOverview.activeUsers}), 0)::int`,
        assistantUsers: sql<number>`coalesce(sum(${analyticsDailyOverview.assistantUsers}), 0)::int`,
        checkoutUsers: sql<number>`coalesce(sum(${analyticsDailyOverview.checkoutCompleted}), 0)::int`,
        conversationsStarted: sql<number>`coalesce(sum(${analyticsDailyOverview.conversationsStarted}), 0)::int`,
        engagedMs: sql<number>`coalesce(sum(${analyticsDailyOverview.engagedMs}), 0)::int`,
        favorites: sql<number>`coalesce(sum(${analyticsDailyOverview.favorites}), 0)::int`,
        listingViews: sql<number>`coalesce(sum(${analyticsDailyOverview.listingViews}), 0)::int`,
        messageSenders: sql<number>`coalesce(sum(${analyticsDailyOverview.messageSenders}), 0)::int`,
        pageViews: sql<number>`coalesce(sum(${analyticsDailyOverview.pageViews}), 0)::int`,
        screenViews: sql<number>`coalesce(sum(${analyticsDailyOverview.screenViews}), 0)::int`,
        sessions: sql<number>`coalesce(sum(${analyticsDailyOverview.sessions}), 0)::int`,
        uniqueListingViewers: sql<number>`coalesce(sum(${analyticsDailyOverview.uniqueListingViewers}), 0)::int`,
        lastRollupAt: sql<Date | null>`max(${analyticsDailyOverview.updatedAt})`
      })
      .from(analyticsDailyOverview)
      .where(dailyWhere)
  ]);

  const dailyRow = daily[0];
  const sessions = dailyRow?.sessions ?? 0;

  return {
    activeUsers: dailyRow?.activeUsers ?? 0,
    assistantUsers: dailyRow?.assistantUsers ?? 0,
    averageSessionEngagementMs: sessions > 0 ? Math.round((dailyRow?.engagedMs ?? 0) / sessions) : 0,
    chatUsers: dailyRow?.messageSenders ?? 0,
    checkoutUsers: dailyRow?.checkoutUsers ?? 0,
    conversationsStarted: dailyRow?.conversationsStarted ?? 0,
    dau: dailyRow?.activeUsers ?? 0,
    favoriteUsers: dailyRow?.favorites ?? 0,
    googleLinkedRate: calculateRate(googleSnapshot, userSnapshot.totalRegisteredUsers),
    googleLinkedUsers: googleSnapshot,
    lastRollupAt: formatDateLike(dailyRow?.lastRollupAt),
    listingViews: dailyRow?.listingViews ?? 0,
    messageSenders: dailyRow?.messageSenders ?? 0,
    pageViews: dailyRow?.pageViews ?? 0,
    passwordUsers: passwordSnapshot,
    screenViews: dailyRow?.screenViews ?? 0,
    sessions,
    totalRegisteredUsers: userSnapshot.totalRegisteredUsers,
    uniqueListingViewers: dailyRow?.uniqueListingViewers ?? 0,
    verifiedRate: calculateRate(userSnapshot.verifiedUsers, userSnapshot.totalRegisteredUsers),
    verifiedUsers: userSnapshot.verifiedUsers
  };
}

export async function listAdminAnalyticsPages(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsPageRow[]> {
  const range = normalizeAnalyticsRange(query);
  const rows = await app.db
    .select({
      averageEngagedMs: sql<number>`coalesce(sum(${analyticsDailyPages.averageEngagedMs}), 0)::int`,
      exits: sql<number>`coalesce(sum(${analyticsDailyPages.exits}), 0)::int`,
      p50EngagedMs: sql<number>`coalesce(max(${analyticsDailyPages.p50EngagedMs}), 0)::int`,
      p90EngagedMs: sql<number>`coalesce(max(${analyticsDailyPages.p90EngagedMs}), 0)::int`,
      platform: analyticsDailyPages.platform,
      surface: analyticsDailyPages.surface,
      uniqueSessions: sql<number>`coalesce(sum(${analyticsDailyPages.uniqueSessions}), 0)::int`,
      uniqueUsers: sql<number>`coalesce(sum(${analyticsDailyPages.uniqueUsers}), 0)::int`,
      views: sql<number>`coalesce(sum(${analyticsDailyPages.views}), 0)::int`
    })
    .from(analyticsDailyPages)
    .where(buildDailyWhere(query, range, analyticsDailyPages.date, analyticsDailyPages.platform))
    .groupBy(analyticsDailyPages.platform, analyticsDailyPages.surface)
    .orderBy(desc(sql`sum(${analyticsDailyPages.views})`))
    .limit(50);

  return rows.map((row) => ({
    averageEngagementMs: row.averageEngagedMs,
    exits: row.exits,
    p50EngagementMs: row.p50EngagedMs,
    p90EngagementMs: row.p90EngagedMs,
    platform: row.platform,
    surface: row.surface,
    uniqueSessions: row.uniqueSessions,
    uniqueUsers: row.uniqueUsers,
    views: row.views
  }));
}

export async function listAdminAnalyticsCategories(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsCategoryRow[]> {
  const range = normalizeAnalyticsRange(query);
  const rows = await app.db
    .select({
      cartAdds: sql<number>`coalesce(sum(${analyticsDailyCategories.cartAdds}), 0)::int`,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      checkoutCompleted: sql<number>`coalesce(sum(${analyticsDailyCategories.checkoutCompleted}), 0)::int`,
      conversationsStarted: sql<number>`coalesce(sum(${analyticsDailyCategories.conversationsStarted}), 0)::int`,
      favorites: sql<number>`coalesce(sum(${analyticsDailyCategories.favorites}), 0)::int`,
      impressions: sql<number>`coalesce(sum(${analyticsDailyCategories.impressions}), 0)::int`,
      listingViews: sql<number>`coalesce(sum(${analyticsDailyCategories.listingViews}), 0)::int`,
      platform: analyticsDailyCategories.platform,
      uniqueViewers: sql<number>`coalesce(sum(${analyticsDailyCategories.uniqueViewers}), 0)::int`
    })
    .from(analyticsDailyCategories)
    .innerJoin(productCategories, eq(analyticsDailyCategories.categoryId, productCategories.id))
    .where(buildDailyWhere(query, range, analyticsDailyCategories.date, analyticsDailyCategories.platform))
    .groupBy(productCategories.id, productCategories.name, analyticsDailyCategories.platform)
    .orderBy(desc(sql`sum(${analyticsDailyCategories.listingViews})`))
    .limit(50);

  return rows;
}

export async function listAdminAnalyticsAuth(
  app: FastifyInstance,
  query: AdminAnalyticsQuery
): Promise<AdminAnalyticsAuthRow[]> {
  const range = normalizeAnalyticsRange(query);
  return app.db
    .select({
      approvalCompletions: sql<number>`coalesce(sum(${analyticsDailyAuth.approvalCompletions}), 0)::int`,
      authProvider: analyticsDailyAuth.authProvider,
      emailVerifications: sql<number>`coalesce(sum(${analyticsDailyAuth.emailVerifications}), 0)::int`,
      failedLogins: sql<number>`coalesce(sum(${analyticsDailyAuth.failedLogins}), 0)::int`,
      mfaCompletions: sql<number>`coalesce(sum(${analyticsDailyAuth.mfaCompletions}), 0)::int`,
      platform: analyticsDailyAuth.platform,
      registrations: sql<number>`coalesce(sum(${analyticsDailyAuth.registrations}), 0)::int`,
      successfulLogins: sql<number>`coalesce(sum(${analyticsDailyAuth.successfulLogins}), 0)::int`
    })
    .from(analyticsDailyAuth)
    .where(buildDailyWhere(query, range, analyticsDailyAuth.date, analyticsDailyAuth.platform))
    .groupBy(analyticsDailyAuth.platform, analyticsDailyAuth.authProvider)
    .orderBy(analyticsDailyAuth.platform, analyticsDailyAuth.authProvider);
}

export async function getAdminAnalyticsDataQuality(
  app: FastifyInstance
): Promise<AdminAnalyticsDataQuality> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [row] = await app.db
    .select({
      missingSessionIds: sql<number>`count(*) filter (where ${analyticsEvents.sessionId} = '')::int`,
      rawEvents: sql<number>`count(*)::int`,
      unknownVersions: sql<number>`count(*) filter (where ${analyticsEvents.eventVersion} <> 1)::int`
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.receivedAt, since));

  return {
    duplicateEventsLast7Days: 0,
    missingSessionIdsLast7Days: row?.missingSessionIds ?? 0,
    rawEventsLast7Days: row?.rawEvents ?? 0,
    rejectedEventsLast7Days: 0,
    unknownEventVersionsLast7Days: row?.unknownVersions ?? 0
  };
}

function normalizeAnalyticsRange(query: AdminAnalyticsQuery): { from: string; to: string } {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    from: query.from ?? defaultFrom,
    to: query.to ?? defaultTo
  };
}

function buildDailyWhere(
  query: AdminAnalyticsQuery,
  range: { from: string; to: string },
  dateColumn: AnyPgColumn = analyticsDailyOverview.date,
  platformColumn: AnyPgColumn = analyticsDailyOverview.platform
): SQL | undefined {
  const clauses: SQL[] = [
    gte(dateColumn, range.from),
    lte(dateColumn, range.to)
  ];

  if (query.platform) {
    clauses.push(eq(platformColumn, query.platform));
  }

  return and(...clauses);
}

async function getUserSnapshot(app: FastifyInstance): Promise<{
  totalRegisteredUsers: number;
  verifiedUsers: number;
}> {
  const [row] = await app.db
    .select({
      totalRegisteredUsers: sql<number>`count(*)::int`,
      verifiedUsers: sql<number>`count(*) filter (where ${users.emailVerifiedAt} is not null)::int`
    })
    .from(users);

  return {
    totalRegisteredUsers: row?.totalRegisteredUsers ?? 0,
    verifiedUsers: row?.verifiedUsers ?? 0
  };
}

async function getProviderSnapshot(app: FastifyInstance, provider: "google" | "password"): Promise<number> {
  const [row] = await app.db
    .select({ itemCount: sql<number>`count(distinct ${authAccounts.userId})::int` })
    .from(authAccounts)
    .where(eq(authAccounts.provider, provider));

  return row?.itemCount ?? 0;
}

function calculateRate(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function formatDateLike(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

import {
  analyticsDailyAuth,
  analyticsDailyCategories,
  analyticsDailyOverview,
  analyticsDailyPages,
  analyticsEvents,
  analyticsSessions
} from "@babyloop/database/schema";
import {
  getAllowedAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsPlatform,
  type AnalyticsProperty
} from "@babyloop/shared";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type {
  AnalyticsBatchIngestResponse,
  AnalyticsEventEnvelopeInput
} from "../schemas/analytics.schemas.js";
import type { CurrentUser } from "../plugins/auth.plugin.js";

const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;
const DEFAULT_RAW_RETENTION_DAYS = 90;
const DEFAULT_SESSION_RETENTION_DAYS = 180;

export type AnalyticsEventSource = "client" | "server";

export type TrackServerAnalyticsEventInput = {
  eventName: AnalyticsEventName;
  platform: AnalyticsPlatform;
  eventId?: string;
  eventVersion?: number;
  occurredAt?: Date;
  sessionId?: string;
  anonymousId?: string;
  userId?: string | null;
  profileId?: string | null;
  pagePath?: string | null;
  screenName?: string | null;
  appVersion?: string | null;
  properties?: Record<string, AnalyticsProperty>;
};

export async function ingestAnalyticsBatch(
  app: FastifyInstance,
  input: {
    currentUser: CurrentUser | null;
    events: AnalyticsEventEnvelopeInput[];
    environment?: string;
  }
): Promise<AnalyticsBatchIngestResponse> {
  const response: AnalyticsBatchIngestResponse = {
    accepted: 0,
    duplicated: 0,
    rejected: []
  };

  for (const event of input.events) {
    const validationError = validateAnalyticsEventTiming(event);

    if (validationError) {
      response.rejected.push({
        eventId: event.eventId,
        eventName: event.eventName,
        reason: validationError
      });
      continue;
    }

    const created = await insertAnalyticsEvent(app, {
      currentUser: input.currentUser,
      environment: input.environment ?? readAnalyticsEnvironment(),
      event,
      source: "client"
    });

    if (created === "duplicate") {
      response.duplicated += 1;
    } else {
      response.accepted += 1;
    }
  }

  return response;
}

export async function trackServerAnalyticsEvent(
  app: FastifyInstance,
  input: TrackServerAnalyticsEventInput
): Promise<void> {
  try {
    const event: AnalyticsEventEnvelopeInput = {
      anonymousId: input.anonymousId ?? `server-${input.userId ?? "anonymous"}`,
      eventId: input.eventId ?? randomUUID(),
      eventName: input.eventName,
      eventVersion: input.eventVersion ?? 1,
      occurredAt: (input.occurredAt ?? new Date()).toISOString(),
      platform: input.platform,
      sessionId: input.sessionId ?? `server-${input.userId ?? "anonymous"}`,
      ...(input.pagePath ? { pagePath: input.pagePath } : {}),
      ...(input.screenName ? { screenName: input.screenName } : {}),
      ...(input.appVersion ? { appVersion: input.appVersion } : {}),
      ...(input.properties ? { properties: sanitizeAnalyticsProperties(input.eventName, input.properties) } : {})
    };

    await insertAnalyticsEvent(app, {
      actorProfileId: input.profileId ?? null,
      actorUserId: input.userId ?? null,
      currentUser: null,
      environment: readAnalyticsEnvironment(),
      event,
      source: "server"
    });
  } catch (error) {
    app.log.warn({ error }, "Product analytics server event failed.");
  }
}

export async function rollupAnalyticsDay(
  app: FastifyInstance,
  date: string,
  platform: AnalyticsPlatform | "all" = "all"
): Promise<{ date: string; rowsWritten: number }> {
  const platforms: AnalyticsPlatform[] = platform === "all" ? ["web", "mobile"] : [platform];
  let rowsWritten = 0;

  for (const currentPlatform of platforms) {
    await upsertDailyOverview(app, date, currentPlatform);
    await upsertDailyAuth(app, date, currentPlatform);
    await upsertDailyPages(app, date, currentPlatform);
    await upsertDailyCategories(app, date, currentPlatform);
    rowsWritten += 4;
  }

  return { date, rowsWritten };
}

export async function applyAnalyticsRetention(
  app: FastifyInstance,
  options: {
    now?: Date;
    rawRetentionDays?: number;
    sessionRetentionDays?: number;
    dryRun?: boolean;
  } = {}
): Promise<{ rawEventsDeleted: number; sessionsDeleted: number; dryRun: boolean }> {
  const now = options.now ?? new Date();
  const rawCutoff = new Date(now.getTime() - (options.rawRetentionDays ?? DEFAULT_RAW_RETENTION_DAYS) * 24 * 60 * 60 * 1000);
  const sessionCutoff = new Date(now.getTime() - (options.sessionRetentionDays ?? DEFAULT_SESSION_RETENTION_DAYS) * 24 * 60 * 60 * 1000);

  const [rawCountRow] = await app.db
    .select({ itemCount: sql<number>`count(*)::int` })
    .from(analyticsEvents)
    .where(lt(analyticsEvents.receivedAt, rawCutoff));
  const [sessionCountRow] = await app.db
    .select({ itemCount: sql<number>`count(*)::int` })
    .from(analyticsSessions)
    .where(lt(analyticsSessions.lastSeenAt, sessionCutoff));

  if (options.dryRun) {
    return {
      rawEventsDeleted: rawCountRow?.itemCount ?? 0,
      sessionsDeleted: sessionCountRow?.itemCount ?? 0,
      dryRun: true
    };
  }

  await app.db.delete(analyticsEvents).where(lt(analyticsEvents.receivedAt, rawCutoff));
  await app.db.delete(analyticsSessions).where(lt(analyticsSessions.lastSeenAt, sessionCutoff));

  return {
    rawEventsDeleted: rawCountRow?.itemCount ?? 0,
    sessionsDeleted: sessionCountRow?.itemCount ?? 0,
    dryRun: false
  };
}

function validateAnalyticsEventTiming(event: AnalyticsEventEnvelopeInput): string | null {
  const occurredAt = new Date(event.occurredAt);

  if (Number.isNaN(occurredAt.getTime())) {
    return "invalid_timestamp";
  }

  const now = Date.now();
  const occurredTime = occurredAt.getTime();

  if (occurredTime < now - MAX_EVENT_AGE_MS) {
    return "event_too_old";
  }

  if (occurredTime > now + MAX_FUTURE_SKEW_MS) {
    return "event_in_future";
  }

  return null;
}

async function insertAnalyticsEvent(
  app: FastifyInstance,
  input: {
    currentUser: CurrentUser | null;
    actorProfileId?: string | null;
    actorUserId?: string | null;
    environment: string;
    event: AnalyticsEventEnvelopeInput;
    source: AnalyticsEventSource;
  }
): Promise<"created" | "duplicate"> {
  const existing = await app.db
    .select({ id: analyticsEvents.id })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.eventId, input.event.eventId))
    .limit(1);

  if (existing.length > 0) {
    return "duplicate";
  }

  const properties = sanitizeAnalyticsProperties(input.event.eventName, input.event.properties ?? {});
  const occurredAt = new Date(input.event.occurredAt);
  const routeTemplate = typeof properties.routeTemplate === "string" ? properties.routeTemplate : null;
  const listingId = typeof properties.listingId === "string" ? properties.listingId : null;
  const categoryId = typeof properties.categoryId === "string" ? properties.categoryId : null;
  const conversationId = typeof properties.conversationId === "string" ? properties.conversationId : null;
  const authProvider = typeof properties.authProvider === "string" ? properties.authProvider : null;
  const engagementMs = typeof properties.engagementMs === "number" ? Math.min(Math.max(Math.round(properties.engagementMs), 0), 30_000) : null;

  await app.db.insert(analyticsEvents).values({
    anonymousIdHash: hashAnonymousId(input.event.anonymousId),
    appVersion: input.event.appVersion ?? null,
    authProvider,
    categoryId,
    conversationId,
    engagementMs,
    environment: input.environment,
    eventId: input.event.eventId,
    eventName: input.event.eventName,
    eventVersion: input.event.eventVersion,
    listingId,
    occurredAt,
    pagePath: sanitizePagePath(input.event.pagePath),
    platform: input.event.platform,
    profileId: input.actorProfileId ?? input.currentUser?.profile.id ?? null,
    properties,
    receivedAt: new Date(),
    routeTemplate,
    screenName: input.event.screenName ?? null,
    sessionId: input.event.sessionId,
    source: input.source,
    userId: input.actorUserId ?? input.currentUser?.userId ?? null
  });

  await upsertAnalyticsSession(app, {
    anonymousIdHash: hashAnonymousId(input.event.anonymousId),
    appVersion: input.event.appVersion ?? null,
    environment: input.environment,
    eventName: input.event.eventName,
    engagementMs,
    occurredAt,
    platform: input.event.platform,
    properties,
    sessionId: input.event.sessionId,
    userId: input.actorUserId ?? input.currentUser?.userId ?? null
  });

  return "created";
}

function sanitizeAnalyticsProperties(
  eventName: AnalyticsEventName,
  properties: Record<string, AnalyticsProperty>
): Record<string, AnalyticsProperty> {
  const allowed = new Set(getAllowedAnalyticsProperties(eventName));
  const sanitized: Record<string, AnalyticsProperty> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key)) {
      continue;
    }

    if (typeof value === "string") {
      sanitized[key] = value.slice(0, 240);
    } else if (typeof value === "number") {
      sanitized[key] = Number.isFinite(value) ? value : null;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

async function upsertAnalyticsSession(
  app: FastifyInstance,
  input: {
    anonymousIdHash: string;
    appVersion: string | null;
    environment: string;
    eventName: AnalyticsEventName;
    engagementMs: number | null;
    occurredAt: Date;
    platform: AnalyticsPlatform;
    properties: Record<string, AnalyticsProperty>;
    sessionId: string;
    userId: string | null;
  }
): Promise<void> {
  const pageViewIncrement = input.eventName === "page_viewed" ? 1 : 0;
  const screenViewIncrement = input.eventName === "screen_viewed" ? 1 : 0;
  const listingViewIncrement = input.eventName === "listing_opened" ? 1 : 0;
  const messageIncrement = input.eventName === "message_sent" ? 1 : 0;
  const engagementIncrement = input.eventName === "engagement_heartbeat" ? input.engagementMs ?? 0 : 0;
  const entrySurface = typeof input.properties.routeTemplate === "string"
    ? input.properties.routeTemplate
    : typeof input.properties.screenName === "string"
      ? input.properties.screenName
      : null;

  await app.db
    .insert(analyticsSessions)
    .values({
      activeEngagementMs: engagementIncrement,
      anonymousIdHash: input.anonymousIdHash,
      appVersion: input.appVersion,
      entrySurface,
      environment: input.environment,
      lastSeenAt: input.occurredAt,
      listingViewCount: listingViewIncrement,
      messageCount: messageIncrement,
      pageViewCount: pageViewIncrement,
      platform: input.platform,
      screenViewCount: screenViewIncrement,
      sessionId: input.sessionId,
      startedAt: input.occurredAt,
      userId: input.userId
    })
    .onConflictDoUpdate({
      target: analyticsSessions.sessionId,
      set: {
        activeEngagementMs: sql`${analyticsSessions.activeEngagementMs} + ${engagementIncrement}`,
        appVersion: input.appVersion,
        lastSeenAt: input.occurredAt,
        listingViewCount: sql`${analyticsSessions.listingViewCount} + ${listingViewIncrement}`,
        messageCount: sql`${analyticsSessions.messageCount} + ${messageIncrement}`,
        pageViewCount: sql`${analyticsSessions.pageViewCount} + ${pageViewIncrement}`,
        screenViewCount: sql`${analyticsSessions.screenViewCount} + ${screenViewIncrement}`,
        userId: input.userId
      }
    });
}

async function upsertDailyOverview(app: FastifyInstance, date: string, platform: AnalyticsPlatform): Promise<void> {
  const range = dayRange(date);
  const [row] = await app.db
    .select({
      activeUsers: sql<number>`count(distinct ${analyticsEvents.userId}) filter (where ${analyticsEvents.userId} is not null)::int`,
      assistantQuestions: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'assistant_question_submitted')::int`,
      assistantUsers: sql<number>`count(distinct ${analyticsEvents.userId}) filter (where ${analyticsEvents.eventName} in ('assistant_opened', 'assistant_question_submitted', 'assistant_answer_received') and ${analyticsEvents.userId} is not null)::int`,
      checkoutCompleted: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'checkout_completed')::int`,
      checkoutStarted: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'checkout_started')::int`,
      conversationsStarted: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'conversation_started')::int`,
      engagedMs: sql<number>`coalesce(sum(${analyticsEvents.engagementMs}), 0)::int`,
      favorites: sql<number>`count(*) filter (where ${analyticsEvents.eventName} in ('listing_favorited', 'listing_unfavorited'))::int`,
      listingViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'listing_opened')::int`,
      messageSenders: sql<number>`count(distinct ${analyticsEvents.userId}) filter (where ${analyticsEvents.eventName} = 'message_sent' and ${analyticsEvents.userId} is not null)::int`,
      messagesSent: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'message_sent')::int`,
      newUsers: sql<number>`count(distinct ${analyticsEvents.userId}) filter (where ${analyticsEvents.eventName} = 'registration_completed' and ${analyticsEvents.userId} is not null)::int`,
      pageViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'page_viewed')::int`,
      screenViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'screen_viewed')::int`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
      uniqueListingViewers: sql<number>`count(distinct ${analyticsEvents.userId}) filter (where ${analyticsEvents.eventName} = 'listing_opened' and ${analyticsEvents.userId} is not null)::int`
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.platform, platform), gte(analyticsEvents.occurredAt, range.start), lt(analyticsEvents.occurredAt, range.end)));

  await app.db
    .insert(analyticsDailyOverview)
    .values({
      activeUsers: row?.activeUsers ?? 0,
      assistantQuestions: row?.assistantQuestions ?? 0,
      assistantUsers: row?.assistantUsers ?? 0,
      checkoutCompleted: row?.checkoutCompleted ?? 0,
      checkoutStarted: row?.checkoutStarted ?? 0,
      conversationsStarted: row?.conversationsStarted ?? 0,
      date,
      engagedMs: row?.engagedMs ?? 0,
      favorites: row?.favorites ?? 0,
      listingViews: row?.listingViews ?? 0,
      messageSenders: row?.messageSenders ?? 0,
      messagesSent: row?.messagesSent ?? 0,
      newUsers: row?.newUsers ?? 0,
      pageViews: row?.pageViews ?? 0,
      platform,
      screenViews: row?.screenViews ?? 0,
      sessions: row?.sessions ?? 0,
      totalUsers: row?.activeUsers ?? 0,
      uniqueListingViewers: row?.uniqueListingViewers ?? 0,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [analyticsDailyOverview.date, analyticsDailyOverview.platform],
      set: {
        activeUsers: row?.activeUsers ?? 0,
        assistantQuestions: row?.assistantQuestions ?? 0,
        assistantUsers: row?.assistantUsers ?? 0,
        checkoutCompleted: row?.checkoutCompleted ?? 0,
        checkoutStarted: row?.checkoutStarted ?? 0,
        conversationsStarted: row?.conversationsStarted ?? 0,
        engagedMs: row?.engagedMs ?? 0,
        favorites: row?.favorites ?? 0,
        listingViews: row?.listingViews ?? 0,
        messageSenders: row?.messageSenders ?? 0,
        messagesSent: row?.messagesSent ?? 0,
        newUsers: row?.newUsers ?? 0,
        pageViews: row?.pageViews ?? 0,
        screenViews: row?.screenViews ?? 0,
        sessions: row?.sessions ?? 0,
        totalUsers: row?.activeUsers ?? 0,
        uniqueListingViewers: row?.uniqueListingViewers ?? 0,
        updatedAt: new Date()
      }
    });
}

async function upsertDailyAuth(app: FastifyInstance, date: string, platform: AnalyticsPlatform): Promise<void> {
  const range = dayRange(date);
  const rows = await app.db
    .select({
      authProvider: sql<string>`coalesce(${analyticsEvents.authProvider}, 'unknown')`,
      approvalCompletions: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'login_approval_completed')::int`,
      emailVerifications: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'email_verification_completed')::int`,
      failedLogins: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'login_failed')::int`,
      mfaCompletions: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'mfa_completed')::int`,
      registrations: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'registration_completed')::int`,
      successfulLogins: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'login_completed')::int`
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.platform, platform), gte(analyticsEvents.occurredAt, range.start), lt(analyticsEvents.occurredAt, range.end)))
    .groupBy(sql`coalesce(${analyticsEvents.authProvider}, 'unknown')`);

  for (const row of rows) {
    await app.db.insert(analyticsDailyAuth).values({
      approvalCompletions: row.approvalCompletions,
      authProvider: row.authProvider,
      date,
      emailVerifications: row.emailVerifications,
      failedLogins: row.failedLogins,
      mfaCompletions: row.mfaCompletions,
      platform,
      registrations: row.registrations,
      successfulLogins: row.successfulLogins,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [analyticsDailyAuth.date, analyticsDailyAuth.platform, analyticsDailyAuth.authProvider],
      set: {
        approvalCompletions: row.approvalCompletions,
        emailVerifications: row.emailVerifications,
        failedLogins: row.failedLogins,
        mfaCompletions: row.mfaCompletions,
        registrations: row.registrations,
        successfulLogins: row.successfulLogins,
        updatedAt: new Date()
      }
    });
  }
}

async function upsertDailyPages(app: FastifyInstance, date: string, platform: AnalyticsPlatform): Promise<void> {
  const range = dayRange(date);
  const rows = await app.db
    .select({
      averageEngagedMs: sql<number>`coalesce(avg(${analyticsEvents.engagementMs}) filter (where ${analyticsEvents.eventName} = 'engagement_heartbeat'), 0)::int`,
      p50EngagedMs: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${analyticsEvents.engagementMs}) filter (where ${analyticsEvents.eventName} = 'engagement_heartbeat'), 0)::int`,
      p90EngagedMs: sql<number>`coalesce(percentile_cont(0.9) within group (order by ${analyticsEvents.engagementMs}) filter (where ${analyticsEvents.eventName} = 'engagement_heartbeat'), 0)::int`,
      surface: sql<string>`coalesce(${analyticsEvents.routeTemplate}, ${analyticsEvents.screenName}, 'unknown')`,
      totalEngagedMs: sql<number>`coalesce(sum(${analyticsEvents.engagementMs}), 0)::int`,
      uniqueSessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
      uniqueUsers: sql<number>`count(distinct ${analyticsEvents.userId}) filter (where ${analyticsEvents.userId} is not null)::int`,
      views: sql<number>`count(*) filter (where ${analyticsEvents.eventName} in ('page_viewed', 'screen_viewed'))::int`
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.platform, platform), gte(analyticsEvents.occurredAt, range.start), lt(analyticsEvents.occurredAt, range.end)))
    .groupBy(sql`coalesce(${analyticsEvents.routeTemplate}, ${analyticsEvents.screenName}, 'unknown')`);

  for (const row of rows) {
    await app.db.insert(analyticsDailyPages).values({
      averageEngagedMs: row.averageEngagedMs,
      date,
      exits: 0,
      p50EngagedMs: row.p50EngagedMs,
      p90EngagedMs: row.p90EngagedMs,
      platform,
      surface: row.surface,
      totalEngagedMs: row.totalEngagedMs,
      uniqueSessions: row.uniqueSessions,
      uniqueUsers: row.uniqueUsers,
      updatedAt: new Date(),
      views: row.views
    }).onConflictDoUpdate({
      target: [analyticsDailyPages.date, analyticsDailyPages.platform, analyticsDailyPages.surface],
      set: {
        averageEngagedMs: row.averageEngagedMs,
        p50EngagedMs: row.p50EngagedMs,
        p90EngagedMs: row.p90EngagedMs,
        totalEngagedMs: row.totalEngagedMs,
        uniqueSessions: row.uniqueSessions,
        uniqueUsers: row.uniqueUsers,
        updatedAt: new Date(),
        views: row.views
      }
    });
  }
}

async function upsertDailyCategories(app: FastifyInstance, date: string, platform: AnalyticsPlatform): Promise<void> {
  const range = dayRange(date);
  const rows = await app.db
    .select({
      cartAdds: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'cart_item_added')::int`,
      categoryId: analyticsEvents.categoryId,
      checkoutCompleted: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'checkout_completed')::int`,
      conversationsStarted: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'conversation_started')::int`,
      favorites: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'listing_favorited')::int`,
      impressions: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'listing_impression')::int`,
      listingViews: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'listing_opened')::int`,
      uniqueViewers: sql<number>`count(distinct ${analyticsEvents.userId}) filter (where ${analyticsEvents.userId} is not null)::int`
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.platform, platform), gte(analyticsEvents.occurredAt, range.start), lt(analyticsEvents.occurredAt, range.end)))
    .groupBy(analyticsEvents.categoryId);

  for (const row of rows) {
    if (!row.categoryId) {
      continue;
    }

    await app.db.insert(analyticsDailyCategories).values({
      cartAdds: row.cartAdds,
      categoryId: row.categoryId,
      checkoutCompleted: row.checkoutCompleted,
      conversationsStarted: row.conversationsStarted,
      date,
      favorites: row.favorites,
      impressions: row.impressions,
      listingViews: row.listingViews,
      platform,
      uniqueViewers: row.uniqueViewers,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [analyticsDailyCategories.date, analyticsDailyCategories.platform, analyticsDailyCategories.categoryId],
      set: {
        cartAdds: row.cartAdds,
        checkoutCompleted: row.checkoutCompleted,
        conversationsStarted: row.conversationsStarted,
        favorites: row.favorites,
        impressions: row.impressions,
        listingViews: row.listingViews,
        uniqueViewers: row.uniqueViewers,
        updatedAt: new Date()
      }
    });
  }
}

function dayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function sanitizePagePath(pagePath: string | undefined): string | null {
  if (!pagePath) {
    return null;
  }

  const pathOnly = pagePath.split("?")[0]?.split("#")[0] ?? "";
  return pathOnly.slice(0, 320) || null;
}

function hashAnonymousId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readAnalyticsEnvironment(): string {
  return (process.env.BABYLOOP_ANALYTICS_ENVIRONMENT ?? process.env.NODE_ENV ?? "development").slice(0, 40);
}

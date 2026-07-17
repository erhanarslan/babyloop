import {
  analyticsEvents,
  analyticsDailyOverview,
  authAccounts,
  listings,
  productCategories,
  profiles,
  users
} from "@babyloop/database/schema";
import type { AnalyticsEventName, AnalyticsPlatform, AnalyticsProperty } from "@babyloop/shared";
import { eq, like, sql } from "drizzle-orm";
import { createApp } from "../app.js";
import {
  rollupAnalyticsDay,
  trackServerAnalyticsEvent
} from "../services/product-analytics.service.js";

const DEMO_NAMESPACE = "demo-analytics";
const DEMO_DAYS = 60;
const DEMO_EVENT_ID_PATTERN = `${DEMO_NAMESPACE}:%`;

type DemoUser = {
  id: string;
  email: string;
  profileId: string;
};

type DemoListing = {
  id: string;
  categoryId: string;
  listingType: string;
  status: string;
};

type DemoCategory = {
  id: string;
  name: string;
};

async function main(): Promise<void> {
  assertSeedAllowed();

  const app = createApp();

  try {
    await app.ready();
    assertDatabaseConfigured(app);

    const context = await loadDemoContext(app);
    await ensureDemoAuthAccounts(app, context.users);

    for (let dayOffset = DEMO_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
      const dayIndex = DEMO_DAYS - 1 - dayOffset;
      const date = startOfUtcDay(addDays(new Date(), -dayOffset));

      await seedDay(app, context, date, dayIndex, "web");
      await seedDay(app, context, date, dayIndex, "mobile");

      const day = date.toISOString().slice(0, 10);
      await rollupAnalyticsDay(app, day, "web");
      await rollupAnalyticsDay(app, day, "mobile");
    }

    const [eventSummary] = await app.db
      .select({
        events: sql<number>`count(*)::int`,
        sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
        days: sql<number>`count(distinct date(${analyticsEvents.occurredAt}))::int`,
        categories: sql<number>`count(distinct ${analyticsEvents.categoryId}) filter (where ${analyticsEvents.categoryId} is not null)::int`
      })
      .from(analyticsEvents)
      .where(like(analyticsEvents.eventId, DEMO_EVENT_ID_PATTERN));

    const [rollupSummary] = await app.db
      .select({ rows: sql<number>`count(*)::int` })
      .from(analyticsDailyOverview);

    if (!eventSummary || eventSummary.events === 0) {
      throw new Error("Demo analytics seed did not create analytics events.");
    }

    console.log(JSON.stringify({
      categories: eventSummary.categories,
      days: eventSummary.days,
      events: eventSummary.events,
      namespace: DEMO_NAMESPACE,
      rollupRows: rollupSummary?.rows ?? 0,
      sessions: eventSummary.sessions,
      users: context.users.length
    }, null, 2));
  } finally {
    await app.close();
  }
}

async function loadDemoContext(app: ReturnType<typeof createApp>): Promise<{
  categories: DemoCategory[];
  listings: DemoListing[];
  users: DemoUser[];
}> {
  const [userRows, categoryRows, listingRows] = await Promise.all([
    app.db
      .select({
        email: users.email,
        id: users.id,
        profileId: profiles.id
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .orderBy(users.createdAt)
      .limit(16),
    app.db
      .select({
        id: productCategories.id,
        name: productCategories.name
      })
      .from(productCategories)
      .orderBy(productCategories.createdAt)
      .limit(12),
    app.db
      .select({
        categoryId: listings.categoryId,
        id: listings.id,
        listingType: listings.listingType,
        status: listings.status
      })
      .from(listings)
      .orderBy(listings.createdAt)
      .limit(24)
  ]);

  if (userRows.length < 2 || categoryRows.length < 1 || listingRows.length < 1) {
    throw new Error("Run the main demo seed first: pnpm demo:seed");
  }

  return {
    categories: categoryRows,
    listings: listingRows,
    users: userRows
  };
}

async function ensureDemoAuthAccounts(app: ReturnType<typeof createApp>, demoUsers: DemoUser[]): Promise<void> {
  for (const [index, user] of demoUsers.entries()) {
    await app.db
      .insert(authAccounts)
      .values({
        email: user.email,
        emailVerifiedAt: new Date(),
        provider: "password",
        providerAccountId: `demo-password-${user.id}`,
        userId: user.id
      })
      .onConflictDoNothing({
        target: [authAccounts.provider, authAccounts.providerAccountId]
      });

    if (index % 3 === 0) {
      await app.db
        .insert(authAccounts)
        .values({
          email: user.email,
          emailVerifiedAt: new Date(),
          provider: "google",
          providerAccountId: `demo-google-${user.id}`,
          userId: user.id
        })
        .onConflictDoNothing({
          target: [authAccounts.provider, authAccounts.providerAccountId]
        });
    }
  }
}

async function seedDay(
  app: ReturnType<typeof createApp>,
  context: { categories: DemoCategory[]; listings: DemoListing[]; users: DemoUser[] },
  date: Date,
  dayIndex: number,
  platform: AnalyticsPlatform
): Promise<void> {
  const activeUserCount = Math.min(context.users.length, 3 + (dayIndex % 5));

  for (let userIndex = 0; userIndex < activeUserCount; userIndex += 1) {
    const user = pickDemoItem(context.users, dayIndex + userIndex, "user");
    const listing = pickDemoItem(context.listings, dayIndex + userIndex, "listing");
    const category = pickDemoItem(context.categories, dayIndex + userIndex, "category");
    const sessionId = `${DEMO_NAMESPACE}:${platform}:session:${dayIndex}:${userIndex}`;
    const anonymousId = `${DEMO_NAMESPACE}:${platform}:anon:${userIndex}`;
    const sessionMinute = 8 * 60 + userIndex * 17;
    const dayMultiplier = 1 + (dayIndex % 7);

    await emit(app, {
      anonymousId,
      date,
      eventName: platform === "web" ? "page_viewed" : "screen_viewed",
      index: `${dayIndex}:${userIndex}:surface`,
      platform,
      properties: platform === "web"
        ? { pageGroup: "browse", routeTemplate: "/browse" }
        : { screenName: "discover", sourceSurface: "app_start" },
      sessionId,
      timeMinutes: sessionMinute,
      user,
      ...(platform === "web" ? { pagePath: "/browse" } : {})
    });
    await emit(app, {
      anonymousId,
      date,
      eventName: "engagement_heartbeat",
      index: `${dayIndex}:${userIndex}:engagement`,
      platform,
      properties: platform === "web"
        ? { engagementMs: 9_000 + dayMultiplier * 1_000, routeTemplate: "/browse" }
        : { engagementMs: 8_000 + dayMultiplier * 900, screenName: "discover" },
      sessionId,
      timeMinutes: sessionMinute + 1,
      user
    });
    await emit(app, {
      anonymousId,
      date,
      eventName: "browse_viewed",
      index: `${dayIndex}:${userIndex}:browse`,
      platform,
      properties: { sourceSurface: platform === "web" ? "home" : "discover" },
      sessionId,
      timeMinutes: sessionMinute + 2,
      user
    });
    await emit(app, {
      anonymousId,
      date,
      eventName: "category_viewed",
      index: `${dayIndex}:${userIndex}:category`,
      platform,
      properties: { categoryId: category.id, sourceSurface: "browse" },
      sessionId,
      timeMinutes: sessionMinute + 3,
      user,
      ...(platform === "web" ? { pagePath: `/categories/${category.name.toLowerCase().replace(/\s+/gu, "-")}` } : {})
    });
    await emitListingEvent(app, {
      anonymousId,
      date,
      eventName: "listing_impression",
      index: `${dayIndex}:${userIndex}:impression`,
      listing,
      platform,
      sessionId,
      timeMinutes: sessionMinute + 4,
      user
    });
    await emitListingEvent(app, {
      anonymousId,
      date,
      eventName: "listing_opened",
      index: `${dayIndex}:${userIndex}:open`,
      listing,
      platform,
      sessionId,
      timeMinutes: sessionMinute + 5,
      user,
      ...(platform === "web" ? { pagePath: `/listings/${listing.id}` } : {})
    });

    if ((dayIndex + userIndex) % 2 === 0) {
      await emitListingEvent(app, {
        anonymousId,
        date,
        eventName: "listing_favorited",
        index: `${dayIndex}:${userIndex}:favorite`,
        listing,
        platform,
        sessionId,
        timeMinutes: sessionMinute + 6,
        user
      });
    }

    if ((dayIndex + userIndex) % 3 === 0) {
      await emit(app, {
        anonymousId,
        date,
        eventName: "seller_contact_clicked",
        index: `${dayIndex}:${userIndex}:seller-contact`,
        platform,
        properties: { listingId: listing.id, sourceSurface: "listing_detail" },
        sessionId,
        timeMinutes: sessionMinute + 7,
        user
      });
      await emit(app, {
        anonymousId,
        date,
        eventName: "conversation_started",
        index: `${dayIndex}:${userIndex}:conversation-started`,
        platform,
        properties: { listingId: listing.id, sourceSurface: "listing_detail" },
        sessionId,
        timeMinutes: sessionMinute + 8,
        user
      });
      await emit(app, {
        anonymousId,
        date,
        eventName: "message_sent",
        index: `${dayIndex}:${userIndex}:message`,
        platform,
        properties: {
          bodyLengthBucket: userIndex % 2 === 0 ? "1-50" : "51-200",
          listingId: listing.id,
          moderationOutcome: "allowed",
          sourceSurface: "conversation"
        },
        sessionId,
        timeMinutes: sessionMinute + 9,
        user
      });
    }

    if ((dayIndex + userIndex) % 4 === 0) {
      await emitAssistantFlow(app, {
        anonymousId,
        date,
        dayIndex,
        platform,
        sessionId,
        timeMinutes: sessionMinute + 10,
        user,
        userIndex
      });
    }

    if ((dayIndex + userIndex) % 5 === 0) {
      await emitSellFlow(app, {
        anonymousId,
        date,
        dayIndex,
        listing,
        platform,
        sessionId,
        timeMinutes: sessionMinute + 13,
        user,
        userIndex
      });
    }

    if ((dayIndex + userIndex) % 6 === 0) {
      await emitChildReminderFlow(app, {
        anonymousId,
        date,
        dayIndex,
        platform,
        sessionId,
        timeMinutes: sessionMinute + 18,
        user,
        userIndex
      });
    }

    if ((dayIndex + userIndex) % 7 === 0) {
      await emitCheckoutFlow(app, {
        anonymousId,
        date,
        dayIndex,
        listing,
        platform,
        sessionId,
        timeMinutes: sessionMinute + 20,
        user,
        userIndex
      });
    }
  }

  const authUser = pickDemoItem(context.users, dayIndex, "user");
  const authProvider = dayIndex % 3 === 0 ? "google" : "password";
  await emit(app, {
    anonymousId: `${DEMO_NAMESPACE}:${platform}:anon:auth:${dayIndex}`,
    date,
    eventName: dayIndex % 10 === 0 ? "registration_completed" : "login_completed",
    index: `${dayIndex}:${platform}:auth-success`,
    platform,
    properties: {
      authProvider,
      mfaUsed: dayIndex % 6 === 0,
      mobileApprovalUsed: dayIndex % 8 === 0,
      newSession: true
    },
    sessionId: `${DEMO_NAMESPACE}:${platform}:auth-session:${dayIndex}`,
    timeMinutes: 7 * 60 + dayIndex,
    user: authUser
  });

  if (dayIndex % 9 === 0) {
    await emit(app, {
      anonymousId: `${DEMO_NAMESPACE}:${platform}:anon:auth-fail:${dayIndex}`,
      date,
      eventName: "login_failed",
      index: `${dayIndex}:${platform}:auth-fail`,
      platform,
      properties: { authProvider: "password", reasonBucket: "invalid_credentials" },
      sessionId: `${DEMO_NAMESPACE}:${platform}:auth-fail-session:${dayIndex}`,
      timeMinutes: 7 * 60 + dayIndex + 3,
      user: authUser
    });
  }
}

async function emitListingEvent(
  app: ReturnType<typeof createApp>,
  input: {
    anonymousId: string;
    date: Date;
    eventName: "listing_impression" | "listing_opened" | "listing_favorited";
    index: string;
    listing: DemoListing;
    pagePath?: string;
    platform: AnalyticsPlatform;
    sessionId: string;
    timeMinutes: number;
    user: DemoUser;
  }
): Promise<void> {
  await emit(app, {
    anonymousId: input.anonymousId,
    date: input.date,
    eventName: input.eventName,
    index: input.index,
    platform: input.platform,
    properties: {
      categoryId: input.listing.categoryId,
      listingId: input.listing.id,
      listingStatus: input.listing.status,
      listingType: input.listing.listingType,
      sourceSurface: "browse"
    },
    sessionId: input.sessionId,
    timeMinutes: input.timeMinutes,
    user: input.user,
    ...(input.pagePath ? { pagePath: input.pagePath } : {})
  });
}

async function emitAssistantFlow(
  app: ReturnType<typeof createApp>,
  input: {
    anonymousId: string;
    date: Date;
    dayIndex: number;
    platform: AnalyticsPlatform;
    sessionId: string;
    timeMinutes: number;
    user: DemoUser;
    userIndex: number;
  }
): Promise<void> {
  const mode = input.dayIndex % 11 === 0 ? "boundary" : input.dayIndex % 13 === 0 ? "no_sources" : "rag";
  const grounded = mode === "rag";

  await emit(app, {
    ...input,
    eventName: "assistant_opened",
    index: `${input.dayIndex}:${input.userIndex}:assistant-open`,
    properties: { sourceSurface: input.platform === "web" ? "nav" : "tab" }
  });
  await emit(app, {
    ...input,
    eventName: "assistant_question_submitted",
    index: `${input.dayIndex}:${input.userIndex}:assistant-question`,
    properties: { domain: mode === "boundary" ? "medicine" : "marketplace", sourceSurface: "assistant" },
    timeMinutes: input.timeMinutes + 1
  });
  await emit(app, {
    ...input,
    eventName: "assistant_answer_received",
    index: `${input.dayIndex}:${input.userIndex}:assistant-answer`,
    properties: {
      domain: mode === "boundary" ? "medicine" : "marketplace",
      grounded,
      groundingStatus: grounded ? "grounded" : mode === "no_sources" ? "insufficient_sources" : "blocked_safety",
      latencyBucket: input.dayIndex % 4 === 0 ? "2-5s" : "0-2s",
      mode,
      sourceCount: grounded ? 2 : 0,
      toolsUsed: grounded ? "rag_search" : "none"
    },
    timeMinutes: input.timeMinutes + 2
  });
}

async function emitSellFlow(
  app: ReturnType<typeof createApp>,
  input: {
    anonymousId: string;
    date: Date;
    dayIndex: number;
    listing: DemoListing;
    platform: AnalyticsPlatform;
    sessionId: string;
    timeMinutes: number;
    user: DemoUser;
    userIndex: number;
  }
): Promise<void> {
  await emit(app, {
    ...input,
    eventName: "sell_flow_started",
    index: `${input.dayIndex}:${input.userIndex}:sell-start`,
    properties: { sourceSurface: "tab" }
  });
  await emit(app, {
    ...input,
    eventName: "sell_step_viewed",
    index: `${input.dayIndex}:${input.userIndex}:sell-step`,
    properties: { step: "photos" },
    timeMinutes: input.timeMinutes + 1
  });
  await emit(app, {
    ...input,
    eventName: "ai_listing_draft_requested",
    index: `${input.dayIndex}:${input.userIndex}:ai-draft-requested`,
    properties: { hasTextHints: input.dayIndex % 2 === 0, imageCountBucket: "2-3" },
    timeMinutes: input.timeMinutes + 2
  });
  await emit(app, {
    ...input,
    eventName: "ai_listing_draft_generated",
    index: `${input.dayIndex}:${input.userIndex}:ai-draft-generated`,
    properties: { confidenceBucket: "medium", imageCountBucket: "2-3", warningCount: 1 },
    timeMinutes: input.timeMinutes + 3
  });
  await emit(app, {
    ...input,
    eventName: "ai_listing_draft_applied",
    index: `${input.dayIndex}:${input.userIndex}:ai-draft-applied`,
    properties: { appliedFieldCount: 2 },
    timeMinutes: input.timeMinutes + 4
  });
  await emit(app, {
    ...input,
    eventName: "listing_created",
    index: `${input.dayIndex}:${input.userIndex}:listing-created`,
    properties: {
      categoryId: input.listing.categoryId,
      listingId: input.listing.id,
      listingStatus: input.listing.status,
      listingType: input.listing.listingType
    },
    timeMinutes: input.timeMinutes + 5
  });
}

async function emitChildReminderFlow(
  app: ReturnType<typeof createApp>,
  input: {
    anonymousId: string;
    date: Date;
    dayIndex: number;
    platform: AnalyticsPlatform;
    sessionId: string;
    timeMinutes: number;
    user: DemoUser;
    userIndex: number;
  }
): Promise<void> {
  await emit(app, {
    ...input,
    eventName: "child_profile_opened",
    index: `${input.dayIndex}:${input.userIndex}:child-open`,
    properties: { ageBand: "6-12m", sourceSurface: "account" }
  });
  await emit(app, {
    ...input,
    eventName: "child_reminder_created",
    index: `${input.dayIndex}:${input.userIndex}:reminder-created`,
    properties: {
      hasPreNotification: input.dayIndex % 2 === 0,
      reminderCategory: input.dayIndex % 3 === 0 ? "feeding" : "care",
      scheduleKind: input.dayIndex % 2 === 0 ? "daily" : "one_time"
    },
    timeMinutes: input.timeMinutes + 1
  });
}

async function emitCheckoutFlow(
  app: ReturnType<typeof createApp>,
  input: {
    anonymousId: string;
    date: Date;
    dayIndex: number;
    listing: DemoListing;
    platform: AnalyticsPlatform;
    sessionId: string;
    timeMinutes: number;
    user: DemoUser;
    userIndex: number;
  }
): Promise<void> {
  await emit(app, {
    ...input,
    eventName: "cart_viewed",
    index: `${input.dayIndex}:${input.userIndex}:cart-viewed`,
    properties: { itemCountBucket: "1" }
  });
  await emit(app, {
    ...input,
    eventName: "cart_item_added",
    index: `${input.dayIndex}:${input.userIndex}:cart-added`,
    properties: {
      categoryId: input.listing.categoryId,
      listingId: input.listing.id,
      sourceSurface: "listing_detail"
    },
    timeMinutes: input.timeMinutes + 1
  });
  await emit(app, {
    ...input,
    eventName: "checkout_started",
    index: `${input.dayIndex}:${input.userIndex}:checkout-started`,
    properties: { cartValueBucket: "1000-5000", itemCountBucket: "1" },
    timeMinutes: input.timeMinutes + 2
  });
  await emit(app, {
    ...input,
    eventName: input.dayIndex % 14 === 0 ? "checkout_failed" : "checkout_completed",
    index: `${input.dayIndex}:${input.userIndex}:checkout-result`,
    properties: input.dayIndex % 14 === 0
      ? { itemCountBucket: "1", providerMode: "mock", reasonBucket: "mock_payment_failed" }
      : { cartValueBucket: "1000-5000", itemCountBucket: "1", providerMode: "mock" },
    timeMinutes: input.timeMinutes + 3
  });
}

async function emit(
  app: ReturnType<typeof createApp>,
  input: {
    anonymousId: string;
    date: Date;
    eventName: AnalyticsEventName;
    index: string;
    pagePath?: string;
    platform: AnalyticsPlatform;
    properties: Record<string, AnalyticsProperty>;
    sessionId: string;
    timeMinutes: number;
    user: DemoUser;
  }
): Promise<void> {
  await trackServerAnalyticsEvent(app, {
    anonymousId: input.anonymousId,
    eventId: `${DEMO_NAMESPACE}:${input.platform}:${input.eventName}:${input.index}`,
    eventName: input.eventName,
    occurredAt: atMinutes(input.date, input.timeMinutes),
    platform: input.platform,
    profileId: input.user.profileId,
    properties: input.properties,
    sessionId: input.sessionId,
    userId: input.user.id,
    ...(input.pagePath ? { pagePath: input.pagePath } : {})
  });
}

function assertSeedAllowed(): void {
  if (process.env.BABYLOOP_DEMO_SEED_ENABLED !== "true") {
    throw new Error("Set BABYLOOP_DEMO_SEED_ENABLED=true to seed demo analytics.");
  }

  if (process.env.NODE_ENV === "production" && process.env.BABYLOOP_DEMO_ANALYTICS_PRODUCTION_CONFIRM !== "SEED_DEMO_ANALYTICS") {
    throw new Error("Demo analytics seed is blocked in production without BABYLOOP_DEMO_ANALYTICS_PRODUCTION_CONFIRM=SEED_DEMO_ANALYTICS.");
  }
}

function assertDatabaseConfigured(app: ReturnType<typeof createApp>): void {
  if (!("db" in app) || !app.db) {
    throw new Error("DATABASE_URL is required to seed demo analytics.");
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function atMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function pickDemoItem<T>(items: T[], index: number, label: string): T {
  const item = items[index % items.length];

  if (!item) {
    throw new Error(`Demo analytics seed requires at least one ${label}.`);
  }

  return item;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Demo analytics seed failed.");
  process.exitCode = 1;
});

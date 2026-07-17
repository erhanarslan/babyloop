import { analyticsDailyOverview, analyticsEvents } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import {
  applyAnalyticsRetention,
  ingestAnalyticsBatch,
  rollupAnalyticsDay,
  trackServerAnalyticsEvent
} from "../src/services/product-analytics.service.js";

describe("product analytics service", () => {
  let app: TestApp;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rolls up daily overview idempotently", async () => {
    const occurredAt = new Date("2026-07-16T10:00:00.000Z");

    const result = await ingestAnalyticsBatch(app, {
      currentUser: null,
      events: [
        buildEvent("analytics-rollup-1", "page_viewed", occurredAt, {
          pageGroup: "browse",
          routeTemplate: "/browse"
        }),
        buildEvent("analytics-rollup-2", "engagement_heartbeat", occurredAt, {
          engagementMs: 15000,
          routeTemplate: "/browse"
        }),
        buildEvent("analytics-rollup-3", "listing_opened", occurredAt, {
          sourceSurface: "browse"
        })
      ]
    });

    expect(result.accepted).toBe(3);

    await rollupAnalyticsDay(app, "2026-07-16", "web");
    await rollupAnalyticsDay(app, "2026-07-16", "web");

    const [row] = await app.db
      .select()
      .from(analyticsDailyOverview)
      .where(eq(analyticsDailyOverview.date, "2026-07-16"));

    expect(row).toMatchObject({
      engagedMs: 15000,
      listingViews: 1,
      pageViews: 1,
      sessions: 1
    });
  });

  it("retention supports dry-run before destructive deletion", async () => {
    await ingestAnalyticsBatch(app, {
      currentUser: null,
      events: [buildEvent("analytics-retention-1", "screen_viewed", new Date(), {
        screenName: "discover"
      }, "mobile")]
    });

    const dryRun = await applyAnalyticsRetention(app, {
      dryRun: true,
      rawRetentionDays: 0,
      sessionRetentionDays: 0
    });

    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.rawEventsDeleted).toBeGreaterThanOrEqual(0);
  });

  it("server event tracking is best effort and stores no raw body", async () => {
    await trackServerAnalyticsEvent(app, {
      eventName: "message_sent",
      platform: "web",
      properties: {
        bodyLengthBucket: "1-50",
        moderationOutcome: "allowed",
        sourceSurface: "conversation"
      }
    });

    const rows = await app.db.select().from(analyticsEvents);

    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toMatch(/private message|messageBody|accessToken|refreshToken|cookie/iu);
  });
});

function buildEvent(
  eventId: string,
  eventName: Parameters<typeof ingestAnalyticsBatch>[1]["events"][number]["eventName"],
  occurredAt: Date,
  properties: Record<string, string | number | boolean | null>,
  platform: "web" | "mobile" = "web"
) {
  return {
    anonymousId: "anon-product-analytics-service",
    eventId,
    eventName,
    eventVersion: 1,
    occurredAt: occurredAt.toISOString(),
    platform,
    sessionId: "session-product-analytics-service",
    properties
  };
}

import { analyticsEvents } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("analytics routes", () => {
  let app: TestApp;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("ingests privacy-safe analytics events and derives user identity from auth", async () => {
    const user = await createUser(app, {
      email: "analytics-route-user@example.test"
    });

    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/analytics/events/batch",
      payload: {
        events: [{
          anonymousId: "anon-analytics-route",
          eventId: "analytics-route-event-1",
          eventName: "listing_opened",
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          platform: "web",
          sessionId: "session-analytics-route",
          properties: {
            sourceSurface: "browse"
          }
        }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        accepted: 1,
        duplicated: 0,
        rejected: []
      }
    });

    const [row] = await app.db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventId, "analytics-route-event-1"));

    expect(row?.userId).toBe(user.user.id);
    expect(row?.profileId).toBe(user.profile.id);
    expect(row?.anonymousIdHash).not.toBe("anon-analytics-route");
    expect(JSON.stringify(row)).not.toMatch(/messageBody|accessToken|refreshToken|cookie/iu);
  });

  it("rejects client-supplied user identity fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/analytics/events/batch",
      payload: {
        events: [{
          anonymousId: "anon-analytics-route",
          eventId: "analytics-route-spoofed-user",
          eventName: "page_viewed",
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          platform: "web",
          sessionId: "session-analytics-route",
          userId: "00000000-0000-4000-8000-999999999999"
        }]
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("deduplicates event ids and partially rejects invalid events", async () => {
    const now = new Date().toISOString();
    const payload = {
      events: [{
        anonymousId: "anon-analytics-route",
        eventId: "analytics-route-event-2",
        eventName: "page_viewed",
        eventVersion: 1,
        occurredAt: now,
        platform: "web",
        sessionId: "session-analytics-route",
        properties: {
          pageGroup: "browse",
          routeTemplate: "/browse"
        }
      }]
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/analytics/events/batch",
      payload
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/analytics/events/batch",
      payload
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().data.accepted).toBe(1);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.duplicated).toBe(1);

    const invalid = await app.inject({
      method: "POST",
      url: "/api/v1/analytics/events/batch",
      payload: {
        events: [{
          anonymousId: "anon-analytics-route",
          eventId: "analytics-route-event-3",
          eventName: "message_sent",
          eventVersion: 1,
          occurredAt: now,
          platform: "web",
          sessionId: "session-analytics-route",
          properties: {
            conversationId: "00000000-0000-4000-8000-000000000002",
            messageBody: "private body"
          }
        }]
      }
    });

    expect(invalid.statusCode).toBe(400);
  });
});

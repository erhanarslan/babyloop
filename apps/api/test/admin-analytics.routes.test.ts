import { authAccounts, users } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { ingestAnalyticsBatch, rollupAnalyticsDay } from "../src/services/product-analytics.service.js";

describe("admin analytics routes", () => {
  let app: TestApp;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires backoffice permissions", async () => {
    const user = await createUser(app, {
      email: "analytics-non-admin@example.test"
    });

    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/admin/analytics/overview"
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns aggregate analytics without sensitive event payloads", async () => {
    const admin = await createUser(app, {
      email: "analytics-admin@example.test",
      role: "admin"
    });
    const googleUser = await createUser(app, {
      email: "analytics-google@example.test"
    });
    const occurredAt = new Date(Date.now() - 60_000);
    const analyticsDate = occurredAt.toISOString().slice(0, 10);

    await app.db
      .update(users)
      .set({ emailVerifiedAt: occurredAt })
      .where(eq(users.id, googleUser.user.id));
    await app.db.insert(authAccounts).values({
      email: googleUser.user.email,
      emailVerifiedAt: occurredAt,
      provider: "google",
      providerAccountId: "google-analytics-user",
      userId: googleUser.user.id
    });

    await ingestAnalyticsBatch(app, {
      currentUser: null,
      events: [{
        anonymousId: "anon-admin-analytics",
        eventId: "admin-analytics-event-1",
        eventName: "page_viewed",
        eventVersion: 1,
        occurredAt: occurredAt.toISOString(),
        platform: "web",
        sessionId: "session-admin-analytics",
        properties: {
          pageGroup: "browse",
          routeTemplate: "/browse"
        }
      }]
    });
    await rollupAnalyticsDay(app, analyticsDate, "web");

    const response = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: `/api/v1/admin/analytics/overview?from=${analyticsDate}&to=${analyticsDate}&platform=web`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        overview: {
          googleLinkedUsers: 1,
          pageViews: 1,
          verifiedUsers: 1
        }
      }
    });
    expect(response.body).not.toMatch(/messageBody|assistantPrompt|accessToken|refreshToken|cookie|analytics-google@example\.test/iu);
  });
});

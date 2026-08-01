import { analyticsEvents, authAccounts, users } from "@babyloop/database/schema";
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

  it("uses recent raw canonical events when rollup is pending and excludes demo accounts", async () => {
    const admin = await createUser(app, { email: "raw-analytics-admin@example.test", role: "admin" });
    const customer = await createUser(app, { email: "raw-analytics-customer@example.test" });
    const demo = await createUser(app, { email: "raw-analytics-demo@example.test" });
    await app.db.update(users).set({ isDemoSystemAccount: true }).where(eq(users.id, demo.user.id));
    const occurredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const date = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul"
    }).format(occurredAt);
    await app.db.insert(analyticsEvents).values([
      rawEvent("raw-listing-customer", "listing_opened", occurredAt, customer.user.id),
      rawEvent("raw-assistant-customer", "assistant_question_submitted", occurredAt, customer.user.id),
      { ...rawEvent("raw-assistant-answer-customer", "assistant_answer_received", occurredAt, customer.user.id), properties: { grounded: true } },
      { ...rawEvent("raw-login-customer", "login_completed", occurredAt, customer.user.id), authProvider: "google" },
      { ...rawEvent("raw-register-customer", "registration_completed", occurredAt, customer.user.id), authProvider: "google" },
      rawEvent("raw-message-customer", "message_sent", occurredAt, customer.user.id),
      rawEvent("raw-message-read-customer", "message_marked_read", occurredAt, customer.user.id),
      rawEvent("raw-child-profile-customer", "child_profile_created", occurredAt, customer.user.id),
      rawEvent("raw-child-note-customer", "child_note_created", occurredAt, customer.user.id),
      rawEvent("raw-child-reminder-customer", "child_reminder_created", occurredAt, customer.user.id),
      rawEvent("raw-listing-demo", "listing_opened", occurredAt, demo.user.id)
    ]);

    const response = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: `/api/v1/admin/analytics/overview?from=${date}&to=${date}&platform=web`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: { overview: {
        aggregationStatus: "pending",
        assistantAnswers: 1,
        assistantGroundedRate: 100,
        assistantQuestions: 1,
        childNotesCreated: 1,
        childProfilesCreated: 1,
        childRemindersCreated: 1,
        dataSource: "raw_recent",
        demoSystemAccounts: 1,
        googleSuccessfulLogins: 1,
        listingViews: 1,
        messagesRead: 1,
        messagesSent: 1,
        rawEventsInRange: 10,
        registrations: 1,
        successfulLogins: 1
      } }
    });
  });
});

function rawEvent(eventId: string, eventName: string, occurredAt: Date, userId: string) {
  return {
    anonymousIdHash: `anon-${eventId}`,
    environment: "test",
    eventId,
    eventName,
    eventVersion: 1,
    occurredAt,
    platform: "web",
    properties: {},
    receivedAt: occurredAt,
    sessionId: `session-${eventId}`,
    source: "server",
    userId
  };
}

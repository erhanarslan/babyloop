import { notificationPreferenceAuditEvents } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("notification preferences routes", () => {
  let app: TestApp;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("requires auth for notification preference reads and updates", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/notification-preferences"
    });
    const update = await app.inject({
      method: "PATCH",
      url: "/api/v1/notification-preferences",
      payload: {
        source: "saved_search",
        channel: "in_app",
        enabled: true
      }
    });

    expect(list.statusCode).toBe(401);
    expect(update.statusCode).toBe(401);
  });

  it("lists source/channel defaults without provider-enabled delivery", async () => {
    const user = await createUser(app, { email: "notification-pref-list@example.test" });
    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/notification-preferences"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.summary).toMatchObject({
      deliveryProvidersEnabled: false,
      providerCallsAllowed: false,
      defaultEnabledChannels: ["in_app"],
      draftOnlyChannels: ["email", "push", "n8n"]
    });
    expect(response.body).toContain("saved_search");
    expect(response.body).toContain("trust_safety");
    expect(response.body).not.toContain(user.user.email);
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("accessToken");
    expect(response.body).not.toContain("refreshToken");
  });

  it("updates a preference and writes a redacted audit event", async () => {
    const user = await createUser(app, { email: "notification-pref-update@example.test" });
    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: "/api/v1/notification-preferences",
      payload: {
        source: "messages",
        channel: "in_app",
        enabled: false,
        reason: "Mute while traveling. parent@example.test +90 555 111 22 33"
      }
    });
    const auditRows = await app.db
      .select()
      .from(notificationPreferenceAuditEvents)
      .where(eq(notificationPreferenceAuditEvents.profileId, user.profile.id));

    expect(response.statusCode).toBe(200);
    expect(response.json().data.preference).toMatchObject({
      source: "messages",
      channel: "in_app",
      enabled: false,
      deliveryAllowed: false,
      providerCallAllowed: false
    });
    expect(response.json().data.auditEvent.reason).toContain("[redacted-email]");
    expect(response.json().data.auditEvent.reason).toContain("[redacted-phone]");
    expect(auditRows).toHaveLength(1);
    expect(JSON.stringify(auditRows)).not.toMatch(/parent@example\.test|\+90 555 111 22 33|accessToken|refreshToken|passwordHash/iu);
  });

  it("rejects invalid source/channel values and unknown fields", async () => {
    const user = await createUser(app);

    const invalidSource = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: "/api/v1/notification-preferences",
      payload: {
        source: "marketing",
        channel: "in_app",
        enabled: true
      }
    });
    const invalidChannel = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: "/api/v1/notification-preferences",
      payload: {
        source: "saved_search",
        channel: "email_draft",
        enabled: true
      }
    });
    const unknownField = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: "/api/v1/notification-preferences",
      payload: {
        source: "saved_search",
        channel: "email",
        enabled: true,
        providerSecret: "must-not-be-accepted"
      }
    });

    expect(invalidSource.statusCode).toBe(400);
    expect(invalidChannel.statusCode).toBe(400);
    expect(unknownField.statusCode).toBe(400);
    expect(unknownField.body).not.toContain("must-not-be-accepted");
  });
});

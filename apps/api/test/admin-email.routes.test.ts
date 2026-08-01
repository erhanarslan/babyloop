import { events } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";

const uniqueAdminEmailRouteEmail = () =>
  `admin-email-route-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

describe("admin email routes", () => {
  let app: TestApp;

  beforeEach(async () => {
    vi.stubEnv("EMAIL_PROVIDER", "mock");
    vi.stubEnv("EMAIL_SEND_ENABLED", "false");
    vi.stubEnv("NOTIFICATION_SMOKE_RECIPIENT_EMAIL", "admin@example.test");

    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it("requires admin permissions for test-send", async () => {
    const user = await createUser(app, { email: uniqueAdminEmailRouteEmail() });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/email/test-send",
      headers: authHeader(user.accessToken),
      payload: {
        to: "admin@example.test",
        intent: "security_alert"
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("rejects invalid admin test-send body", async () => {
    const admin = await createUser(app, {
      email: uniqueAdminEmailRouteEmail(),
      role: "admin"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/email/test-send",
      headers: authHeader(admin.accessToken),
      payload: {
        to: "not-email",
        token: "secret-token"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "EMAIL_TEST_INVALID_RECIPIENT"
      }
    });
    expect(JSON.stringify(response.json())).not.toContain("secret-token");
  });

  it("returns sandbox result for admin test-send while send is disabled", async () => {
    const admin = await createUser(app, {
      email: uniqueAdminEmailRouteEmail(),
      role: "admin"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/email/test-send",
      headers: authHeader(admin.accessToken),
      payload: {
        to: "ADMIN@EXAMPLE.TEST",
        intent: "security_alert",
        note: "SMTP smoke test",
        confirmation: "SEND_TEST_EMAIL",
        idempotencyKey: "33333333-3333-4333-8333-333333333333"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        intent: "security_alert",
        status: "not_sent",
        provider: "mock",
        sandboxOnly: true,
        errorCategory: "delivery_disabled",
        recipientMasked: "a***@example.test"
      }
    });
    expect(JSON.stringify(response.json())).not.toContain("SMTP_PASS");
    expect(JSON.stringify(response.json())).not.toContain("secret");
    expect(JSON.stringify(response.json())).not.toContain("token");
    const auditRows = await app.db
      .select({ eventType: events.eventType, metadata: events.metadata })
      .from(events)
      .where(eq(events.eventType, "admin_email_test_send_completed"));
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.metadata).toMatchObject({
      category: "delivery_disabled",
      intent: "security_alert",
      provider: "mock"
    });
    expect(JSON.stringify(auditRows)).not.toContain("admin@example.test");
  });

  it("returns admin email ops preview safely", async () => {
    const admin = await createUser(app, {
      email: uniqueAdminEmailRouteEmail(),
      role: "admin"
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/email/ops-preview",
      headers: authHeader(admin.accessToken)
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        emailProvider: {
          driver: "mock",
          sendEnabled: false,
          sandboxOnly: true
        },
        supportedIntents: [
          "email_verification",
          "password_reset",
          "notification_digest",
          "security_alert"
        ]
      }
    });
    expect(JSON.stringify(response.json())).not.toContain("SMTP_PASS");
    expect(JSON.stringify(response.json())).not.toContain("RESEND_API_KEY");
    expect(JSON.stringify(response.json())).not.toContain("re_secret");
  });
});

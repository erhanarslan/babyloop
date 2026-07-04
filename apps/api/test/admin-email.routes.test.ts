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
        code: "INVALID_REQUEST"
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
        note: "SMTP smoke test"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        intent: "security_alert",
        result: {
          sent: false,
          provider: "mock",
          sandboxOnly: true,
          reason: "email_delivery_disabled"
        }
      }
    });
    expect(JSON.stringify(response.json())).not.toContain("SMTP_PASS");
    expect(JSON.stringify(response.json())).not.toContain("secret");
    expect(JSON.stringify(response.json())).not.toContain("token");
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

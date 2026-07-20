import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createUser } from "./helpers/auth.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

let app!: TestApp;

const VALID_UUID = "99999999-9999-4999-8999-999999999999";

describe("backoffice route permission matrix", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (app) {
      await app.close();
    }
  });

  it("keeps listing review routes behind listing_review permission", async () => {
    const regularUser = await createUser(app, {
      email: "regular-listing-review@babyloop.test",
      role: "user"
    });
    const support = await createUser(app, {
      email: "support-listing-review@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-listing-review@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-listing-review@babyloop.test",
      role: "admin"
    });

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/admin/listings"
    });
    const userResponse = await app.inject({
      headers: authHeader(regularUser.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings"
    });
    const supportResponse = await app.inject({
      headers: authHeader(support.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings"
    });
    const moderatorResponse = await app.inject({
      headers: authHeader(moderator.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings"
    });
    const adminResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings"
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(userResponse.statusCode).toBe(403);
    expect(supportResponse.statusCode).toBe(403);
    expect(moderatorResponse.statusCode).toBe(200);
    expect(adminResponse.statusCode).toBe(200);

    expectForbiddenBody(userResponse.body);
    expectForbiddenBody(supportResponse.body);
  });

  it("keeps audit routes admin-only through audit_view permission", async () => {
    const regularUser = await createUser(app, {
      email: "regular-audit-view@babyloop.test",
      role: "user"
    });
    const support = await createUser(app, {
      email: "support-audit-view@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-audit-view@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-audit-view@babyloop.test",
      role: "admin"
    });

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit/events"
    });
    const userResponse = await app.inject({
      headers: authHeader(regularUser.accessToken),
      method: "GET",
      url: "/api/v1/admin/audit/events"
    });
    const supportResponse = await app.inject({
      headers: authHeader(support.accessToken),
      method: "GET",
      url: "/api/v1/admin/audit/events"
    });
    const moderatorResponse = await app.inject({
      headers: authHeader(moderator.accessToken),
      method: "GET",
      url: "/api/v1/admin/audit/events"
    });
    const adminResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: "/api/v1/admin/audit/events"
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(userResponse.statusCode).toBe(403);
    expect(supportResponse.statusCode).toBe(403);
    expect(moderatorResponse.statusCode).toBe(403);
    expect(adminResponse.statusCode).toBe(200);

    expectForbiddenBody(userResponse.body);
    expectForbiddenBody(supportResponse.body);
    expectForbiddenBody(moderatorResponse.body);
  });

  it("allows support and moderator read-only trust ops routes while blocking regular users", async () => {
    const regularUser = await createUser(app, {
      email: "regular-view-trust@babyloop.test",
      role: "user"
    });
    const support = await createUser(app, {
      email: "support-view-trust@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-view-trust@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-view-trust@babyloop.test",
      role: "admin"
    });

    for (const url of [
      "/api/v1/admin/profiles",
      "/api/v1/admin/conversations",
      "/api/v1/admin/moderation/cases"
    ]) {
      const unauthenticated = await app.inject({
        method: "GET",
        url
      });
      const userResponse = await app.inject({
        headers: authHeader(regularUser.accessToken),
        method: "GET",
        url
      });
      const supportResponse = await app.inject({
        headers: authHeader(support.accessToken),
        method: "GET",
        url
      });
      const moderatorResponse = await app.inject({
        headers: authHeader(moderator.accessToken),
        method: "GET",
        url
      });
      const adminResponse = await app.inject({
        headers: authHeader(admin.accessToken),
        method: "GET",
        url
      });

      expect(unauthenticated.statusCode, `${url} unauthenticated`).toBe(401);
      expect(userResponse.statusCode, `${url} regular user`).toBe(403);
      expect(supportResponse.statusCode, `${url} support`).toBe(200);
      expect(moderatorResponse.statusCode, `${url} moderator`).toBe(200);
      expect(adminResponse.statusCode, `${url} admin`).toBe(200);

      expectForbiddenBody(userResponse.body);
      expectResponseToBeSecretSafe(supportResponse.body);
      expectResponseToBeSecretSafe(moderatorResponse.body);
      expectResponseToBeSecretSafe(adminResponse.body);
    }
  });

  it("keeps enforcement routes unavailable to support users but available to moderators and admins", async () => {
    const support = await createUser(app, {
      email: "support-enforcement@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-enforcement@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-enforcement@babyloop.test",
      role: "admin"
    });

    const supportModerationAction = await app.inject({
      headers: authHeader(support.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/actions`,
      payload: {
        actionType: "review_started",
        note: "Support should not be able to enforce moderation actions."
      }
    });
    const supportProfileEnforcement = await app.inject({
      headers: authHeader(support.accessToken),
      method: "POST",
      url: `/api/v1/admin/profiles/${VALID_UUID}/enforcement`,
      payload: {
        action: "profile_restrict",
        reason: "Support should not be able to enforce profile actions."
      }
    });
    const moderatorModerationAction = await app.inject({
      headers: authHeader(moderator.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/actions`,
      payload: {
        actionType: "review_started",
        note: "Moderator may pass the route guard before not-found handling."
      }
    });
    const moderatorProfileEnforcement = await app.inject({
      headers: authHeader(moderator.accessToken),
      method: "POST",
      url: `/api/v1/admin/profiles/${VALID_UUID}/enforcement`,
      payload: {
        action: "profile_restrict",
        reason: "Moderator may pass profile enforcement guard before not-found handling."
      }
    });
    const adminModerationAction = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/actions`,
      payload: {
        actionType: "review_started",
        note: "Admin may pass the route guard before not-found handling."
      }
    });
    const adminProfileEnforcement = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/profiles/${VALID_UUID}/enforcement`,
      payload: {
        action: "profile_restrict",
        reason: "Admin may pass profile enforcement guard before not-found handling."
      }
    });

    expect(supportModerationAction.statusCode).toBe(403);
    expect(supportProfileEnforcement.statusCode).toBe(403);
    expect(moderatorModerationAction.statusCode).toBe(404);
    expect(moderatorProfileEnforcement.statusCode).toBe(404);
    expect(adminModerationAction.statusCode).toBe(404);
    expect(adminProfileEnforcement.statusCode).toBe(404);

    expectForbiddenBody(supportModerationAction.body);
    expectForbiddenBody(supportProfileEnforcement.body);
  });

  it("keeps sensitive access unavailable to moderator and support roles", async () => {
    const support = await createUser(app, {
      email: "support-sensitive-access@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-sensitive-access@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-sensitive-access-route@babyloop.test",
      role: "admin"
    });

    const payload = {
      reason: "Review reporter identity for moderation triage.",
      fields: ["reporter"]
    };

    const supportResponse = await app.inject({
      headers: authHeader(support.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/sensitive-access`,
      payload
    });
    const moderatorResponse = await app.inject({
      headers: authHeader(moderator.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/sensitive-access`,
      payload
    });
    const adminResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/moderation/cases/${VALID_UUID}/sensitive-access`,
      payload
    });

    expect(supportResponse.statusCode).toBe(403);
    expect(moderatorResponse.statusCode).toBe(403);
    expect(adminResponse.statusCode).toBe(404);

    expectForbiddenBody(supportResponse.body);
    expectForbiddenBody(moderatorResponse.body);
  });

  it("keeps AI ops unavailable to support and moderator roles through ai_ops_view permission", async () => {
    const support = await createUser(app, {
      email: "support-ai-ops@babyloop.test",
      role: "support"
    });
    const moderator = await createUser(app, {
      email: "moderator-ai-ops@babyloop.test",
      role: "moderator"
    });
    const admin = await createUser(app, {
      email: "admin-ai-ops-route@babyloop.test",
      role: "admin"
    });

    for (const url of ["/api/v1/admin/ai-ops/summary", "/api/v1/admin/ai-ops/runs"]) {
      const supportResponse = await app.inject({
        headers: authHeader(support.accessToken),
        method: "GET",
        url
      });
      const moderatorResponse = await app.inject({
        headers: authHeader(moderator.accessToken),
        method: "GET",
        url
      });
      const adminResponse = await app.inject({
        headers: authHeader(admin.accessToken),
        method: "GET",
        url
      });

      expect(supportResponse.statusCode, `${url} support`).toBe(403);
      expect(moderatorResponse.statusCode, `${url} moderator`).toBe(403);
      expect(adminResponse.statusCode, `${url} admin`).toBe(200);

      expectForbiddenBody(supportResponse.body);
      expectForbiddenBody(moderatorResponse.body);
      expectResponseToBeSecretSafe(adminResponse.body);
    }
  });
});

function expectForbiddenBody(body: string): void {
  expect(body).toContain('"ok":false');
  expect(body).toContain('"code":"FORBIDDEN"');
  expectResponseToBeSecretSafe(body);
}

function expectResponseToBeSecretSafe(body: string): void {
  for (const forbidden of [
    "passwordHash",
    "password_hash",
    "accessToken",
    "refreshToken",
    "babyloop_refresh_token",
    "SMTP_PASS",
    "RESEND_API_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "rawMessageBody",
    "messageBody",
    "reporterEmail"
  ]) {
    expect(body).not.toContain(forbidden);
  }
}

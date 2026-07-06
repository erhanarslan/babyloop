import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("notification push token registry routes", () => {
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

  it("requires auth and rejects invalid token payloads", async () => {
    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/notifications/push-tokens"
    });
    const user = await createUser(app);
    const invalid = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/notifications/push-tokens",
      payload: {
        token: "short",
        platform: "pager"
      }
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body).not.toContain(user.user.email);
  });

  it("registers, lists, and revokes hashed push tokens without returning raw token values", async () => {
    const user = await createUser(app, { email: "push-token-owner@example.test" });
    const rawToken = "ExponentPushToken[very-sensitive-device-token-value]";
    const register = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/notifications/push-tokens",
      payload: {
        token: rawToken,
        platform: "expo",
        deviceLabel: "Galaxy S22"
      }
    });
    const list = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/notifications/push-tokens"
    });
    const revoke = await app.inject({
      headers: authHeader(user.accessToken),
      method: "DELETE",
      url: "/api/v1/notifications/push-tokens",
      payload: {
        token: rawToken
      }
    });

    expect(register.statusCode).toBe(200);
    expect(register.json().data.token).toMatchObject({
      platform: "expo",
      redactedToken: expect.stringContaining("sha256:"),
      deliveryAllowed: false,
      providerCallAllowed: false
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.tokens).toHaveLength(1);
    expect(revoke.statusCode).toBe(200);
    expect(revoke.json().data.revoked).toBe(true);
    expect(`${register.body} ${list.body} ${revoke.body}`).not.toContain(rawToken);
    expect(`${register.body} ${list.body} ${revoke.body}`).not.toMatch(/push-token-owner@example|accessToken|refreshToken|passwordHash|providerSecret/iu);
  });
});

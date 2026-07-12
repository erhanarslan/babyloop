import { loginApprovalChallenges, notificationDeliveryLogs, users } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("login approval push candidates", () => {
  const originalPushTokenEncryptionKey = process.env.PUSH_TOKEN_ENCRYPTION_KEY;
  const originalNotificationPushEnabled = process.env.NOTIFICATION_PUSH_ENABLED;
  const originalPushProvider = process.env.PUSH_PROVIDER;
  const originalExpoAccessToken = process.env.EXPO_ACCESS_TOKEN;
  const originalExpoPushApiBaseUrl = process.env.EXPO_PUSH_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  let app: TestApp;

  beforeEach(async () => {
    process.env.PUSH_TOKEN_ENCRYPTION_KEY = "test-login-approval-push-token-key";
    delete process.env.NOTIFICATION_PUSH_ENABLED;
    delete process.env.PUSH_PROVIDER;
    delete process.env.EXPO_ACCESS_TOKEN;
    delete process.env.EXPO_PUSH_API_BASE_URL;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    process.env.PUSH_TOKEN_ENCRYPTION_KEY = originalPushTokenEncryptionKey;
    process.env.NOTIFICATION_PUSH_ENABLED = originalNotificationPushEnabled;
    process.env.PUSH_PROVIDER = originalPushProvider;
    process.env.EXPO_ACCESS_TOKEN = originalExpoAccessToken;
    process.env.EXPO_PUSH_API_BASE_URL = originalExpoPushApiBaseUrl;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();

    if (app) {
      await app.close();
    }
  });

  it("does not require mobile approval for web login without an active mobile push target", async () => {
    const user = await createUser(app, {
      email: "web-no-mobile-approval-target@example.test",
      password: "Password123!"
    });
    await app.db
      .update(users)
      .set({ mobileLoginApprovalEnabled: true })
      .where(eq(users.id, user.user.id));

    const response = await app.inject({
      headers: {
        "x-babyloop-client": "web"
      },
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "web-no-mobile-approval-target@example.test",
        password: "Password123!",
        clientType: "web"
      }
    });

    const logs = await app.db
      .select()
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, user.profile.id));

    expect(response.statusCode).toBe(200);
    expect(response.json().data.accessToken).toEqual(expect.any(String));
    expect(response.json().data.loginApprovalRequired).toBeUndefined();
    expect(logs).toHaveLength(0);
    expect(response.body).not.toMatch(/approvalToken|approvalTokenHash|passwordHash|refreshToken/iu);
  });

  it("requires mobile approval for web login with active mobile push target and sends a security push", async () => {
    process.env.NOTIFICATION_PUSH_ENABLED = "true";
    process.env.PUSH_PROVIDER = "expo";
    process.env.EXPO_ACCESS_TOKEN = "secret-expo-token";
    process.env.EXPO_PUSH_API_BASE_URL = "https://exp.example.test/push";

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { status: "ok", id: "expo-ticket-1" }
      ]
    }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const user = await createUser(app, {
      email: "web-mobile-approval-target@example.test",
      password: "Password123!"
    });
    await app.db
      .update(users)
      .set({ mobileLoginApprovalEnabled: true })
      .where(eq(users.id, user.user.id));

    const registerPush = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/notifications/push-tokens",
      payload: {
        token: "ExponentPushToken[login-approval-sensitive-device-token]",
        platform: "expo",
        deviceLabel: "Galaxy S22"
      }
    });

    expect(registerPush.statusCode).toBe(200);

    const response = await app.inject({
      headers: {
        "user-agent": "Mozilla/5.0 BabyLoopWeb",
        "x-babyloop-client": "web"
      },
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "web-mobile-approval-target@example.test",
        password: "Password123!",
        clientType: "web"
      }
    });

    const logs = await app.db
      .select()
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, user.profile.id));

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      loginApprovalRequired: true,
      approvalId: expect.any(String),
      approvalToken: expect.any(String)
    });
    expect(response.json().data.accessToken).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    const body = JSON.parse(String((call?.[1] as RequestInit).body)) as Array<Record<string, unknown>>;

    expect(call?.[0]).toBe("https://exp.example.test/push");
    expect(body[0]).toMatchObject({
      to: "ExponentPushToken[login-approval-sensitive-device-token]",
      title: "BabyLoop güvenlik onayı",
      data: {
        source: "security",
        entityType: "login_approval",
        entityId: response.json().data.approvalId
      }
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      kind: "security",
      sourceType: "login_approval",
      channel: "push",
      status: "sent",
      provider: "expo",
      providerStatus: "sent",
      deliveryAllowed: true,
      draftOnly: false,
      attemptCount: 1,
      frequencyWindowHours: 1
    });
    expect(logs[0]!.sourceId).toBe(response.json().data.approvalId);
    expect(JSON.stringify(logs[0])).not.toMatch(
      /login-approval-sensitive-device-token|web-mobile-approval-target@example|approvalToken|approvalTokenHash|passwordHash|authorization|cookie|set-cookie/iu
    );
  });

  it("reuses one pending approval for repeated web login attempts without sending another push", async () => {
    process.env.NOTIFICATION_PUSH_ENABLED = "true";
    process.env.PUSH_PROVIDER = "expo";
    process.env.EXPO_ACCESS_TOKEN = "secret-expo-token";
    process.env.EXPO_PUSH_API_BASE_URL = "https://exp.example.test/push";

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { status: "ok", id: "expo-ticket-1" }
      ]
    }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const user = await createUser(app, {
      email: "web-mobile-approval-dedupe@example.test",
      password: "Password123!"
    });
    await app.db
      .update(users)
      .set({ mobileLoginApprovalEnabled: true })
      .where(eq(users.id, user.user.id));

    const registerPush = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/notifications/push-tokens",
      payload: {
        token: "ExponentPushToken[login-approval-dedupe-device-token]",
        platform: "expo",
        deviceLabel: "Galaxy S22"
      }
    });

    expect(registerPush.statusCode).toBe(200);

    const payload = {
      email: "web-mobile-approval-dedupe@example.test",
      password: "Password123!",
      clientType: "web"
    };

    const first = await app.inject({
      headers: {
        "user-agent": "Mozilla/5.0 BabyLoopWeb",
        "x-babyloop-client": "web"
      },
      method: "POST",
      url: "/api/v1/auth/login",
      payload
    });

    const second = await app.inject({
      headers: {
        "user-agent": "Mozilla/5.0 BabyLoopWeb",
        "x-babyloop-client": "web"
      },
      method: "POST",
      url: "/api/v1/auth/login",
      payload
    });

    const logs = await app.db
      .select()
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, user.profile.id));

    const challenges = await app.db
      .select({
        id: loginApprovalChallenges.id,
        status: loginApprovalChallenges.status
      })
      .from(loginApprovalChallenges)
      .where(eq(loginApprovalChallenges.userId, user.user.id));

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json().data).toMatchObject({
      loginApprovalRequired: true,
      approvalId: expect.any(String),
      approvalToken: expect.any(String)
    });
    expect(second.json().data).toMatchObject({
      loginApprovalRequired: true,
      approvalId: first.json().data.approvalId,
      approvalToken: expect.any(String)
    });
    expect(second.json().data.approvalToken).not.toBe(first.json().data.approvalToken);

    expect(challenges).toEqual([
      {
        id: first.json().data.approvalId,
        status: "pending"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.sourceId).toBe(first.json().data.approvalId);
    expect(`${first.body} ${second.body} ${JSON.stringify(logs)}`).not.toMatch(
      /login-approval-dedupe-device-token|approvalTokenHash|passwordHash|authorization|cookie|set-cookie/iu
    );
  });

  it("does not require mobile approval for mobile login even when approval, provider, and push target exist", async () => {
    process.env.NOTIFICATION_PUSH_ENABLED = "true";
    process.env.PUSH_PROVIDER = "expo";
    process.env.EXPO_ACCESS_TOKEN = "secret-expo-token";
    process.env.EXPO_PUSH_API_BASE_URL = "https://exp.example.test/push";

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { status: "ok", id: "expo-ticket-1" }
      ]
    }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const user = await createUser(app, {
      email: "mobile-login-no-self-approval@example.test",
      password: "Password123!"
    });
    await app.db
      .update(users)
      .set({ mobileLoginApprovalEnabled: true })
      .where(eq(users.id, user.user.id));

    const registerPush = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/notifications/push-tokens",
      payload: {
        token: "ExponentPushToken[mobile-login-sensitive-device-token]",
        platform: "expo",
        deviceLabel: "Galaxy S22"
      }
    });

    expect(registerPush.statusCode).toBe(200);

    const response = await app.inject({
      headers: {
        "x-babyloop-client": "mobile"
      },
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "mobile-login-no-self-approval@example.test",
        password: "Password123!",
        clientType: "mobile"
      }
    });

    const logs = await app.db
      .select()
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, user.profile.id));

    expect(response.statusCode).toBe(200);
    expect(response.json().data.accessToken).toEqual(expect.any(String));
    expect(response.json().data.loginApprovalRequired).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logs).toHaveLength(0);
    expect(`${response.body} ${JSON.stringify(logs)}`).not.toMatch(
      /mobile-login-sensitive-device-token|approvalToken|approvalTokenHash|passwordHash|refreshToken/iu
    );
  });
});

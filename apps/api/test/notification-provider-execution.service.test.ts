import { randomUUID } from "node:crypto";
import { notificationDeliveryLogs, users } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeNotificationProviderDelivery,
  processPendingNotificationProviderDeliveries
} from "../src/services/notification-provider-execution.service.js";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("notification provider execution service", () => {
  const originalPushTokenEncryptionKey = process.env.PUSH_TOKEN_ENCRYPTION_KEY;
  let app: TestApp;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    process.env.PUSH_TOKEN_ENCRYPTION_KEY = originalPushTokenEncryptionKey;

    if (app) {
      await app.close();
    }
  });

  it("skips provider execution without env and does not call network", async () => {
    const user = await createUser(app, { email: "provider-disabled@example.test" });
    const logId = await createDeliveryLog(user.profile.id, "n8n", {
      reminderTitle: "Bez alışverişi",
      email: "provider-disabled@example.test",
      accessToken: "secret-token"
    });
    const fetchImpl = vi.fn();

    const result = await executeNotificationProviderDelivery(app, logId, {
      env: {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: new Date("2030-01-01T10:00:00.000Z")
    });
    const log = await getDeliveryLog(logId);

    expect(result).toMatchObject({
      status: "skipped",
      provider: "n8n",
      reason: "provider_disabled"
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toMatchObject({
      status: "skipped",
      provider: "n8n",
      providerStatus: "skipped",
      skippedReason: "provider_disabled"
    });
    expect(JSON.stringify(log)).not.toMatch(/provider-disabled@example|secret-token|accessToken/iu);
  });

  it("never calls a provider for a draft-only delivery log", async () => {
    const user = await createUser(app, { email: "delivery-disabled@example.test" });
    const logId = await createDeliveryLog(user.profile.id, "n8n", {}, false);
    const fetchImpl = vi.fn();

    const result = await executeNotificationProviderDelivery(app, logId, {
      env: {
        N8N_NOTIFICATION_WEBHOOK_ENABLED: "true",
        N8N_NOTIFICATION_WEBHOOK_URL: "https://n8n.example.test/webhook"
      },
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "delivery_disabled"
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await getDeliveryLog(logId)).toMatchObject({
      status: "skipped",
      skippedReason: "delivery_disabled",
      deliveryAllowed: false,
      draftOnly: true
    });
  });

  it("executes n8n webhook with idempotency and allowlisted payload", async () => {
    const user = await createUser(app, { email: "n8n-provider@example.test" });
    await enablePreference(user.accessToken, "child_reminder", "n8n");
    const logId = await createDeliveryLog(user.profile.id, "n8n", {
      childProfileId: "child-1",
      reminderId: "reminder-1",
      reminderTitle: "Hafta sonu bez al",
      email: "n8n-provider@example.test",
      rawBody: "sensitive raw body"
    });
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => new Response(
      JSON.stringify({ id: "workflow-run-1", email: "leak@example.test" }),
      { status: 200 }
    ));

    const result = await executeNotificationProviderDelivery(app, logId, {
      env: {
        N8N_NOTIFICATION_WEBHOOK_ENABLED: "true",
        N8N_NOTIFICATION_WEBHOOK_URL: "https://n8n.example.test/webhook",
        N8N_NOTIFICATION_WEBHOOK_BEARER_TOKEN: "secret-n8n-token"
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: new Date("2030-01-01T10:00:00.000Z")
    });
    const call = fetchImpl.mock.calls[0];
    const body = JSON.parse(String((call?.[1] as RequestInit).body)) as Record<string, unknown>;
    const log = await getDeliveryLog(logId);

    expect(result.status).toBe("sent");
    expect(call?.[0]).toBe("https://n8n.example.test/webhook");
    expect((call?.[1] as RequestInit).headers).toMatchObject({
      authorization: "Bearer secret-n8n-token",
      "x-idempotency-key": expect.stringContaining("provider-test:n8n")
    });
    expect(body).toMatchObject({
      eventType: "notification.delivery",
      source: "child_reminder",
      channel: "n8n",
      deliveryLogId: logId,
      childProfileId: "child-1",
      reminderId: "reminder-1"
    });
    expect(JSON.stringify(body)).not.toMatch(/n8n-provider@example|raw body|secret-n8n-token|accessToken|refreshToken|passwordHash/iu);
    expect(log).toMatchObject({
      status: "sent",
      provider: "n8n",
      providerStatus: "sent",
      attemptCount: 1,
      deliveryAllowed: true,
      draftOnly: false
    });
    expect(JSON.stringify(log)).not.toMatch(/leak@example|secret-n8n-token/iu);
  });

  it("schedules retry for retryable n8n failures and redacts provider errors", async () => {
    const user = await createUser(app, { email: "n8n-failure@example.test" });
    await enablePreference(user.accessToken, "child_reminder", "n8n");
    const logId = await createDeliveryLog(user.profile.id, "n8n");
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ message: "provider failed for n8n-failure@example.test with secret token" }),
      { status: 500 }
    ));

    const result = await executeNotificationProviderDelivery(app, logId, {
      env: {
        N8N_NOTIFICATION_WEBHOOK_ENABLED: "true",
        N8N_NOTIFICATION_WEBHOOK_URL: "https://n8n.example.test/webhook",
        N8N_NOTIFICATION_WEBHOOK_MAX_RETRIES: "2"
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: new Date("2030-01-01T10:00:00.000Z")
    });
    const log = await getDeliveryLog(logId);

    expect(result).toMatchObject({
      status: "retry_scheduled",
      retryable: true,
      reason: "provider_error"
    });
    expect(log.status).toBe("failed");
    expect(log.providerStatus).toBe("retry_scheduled");
    expect(log.nextAttemptAt).toBeInstanceOf(Date);
    expect(`${log.lastErrorMessageRedacted} ${JSON.stringify(log.providerResponseMeta)}`).not.toMatch(/n8n-failure@example|secret token/iu);
  });

  it("sends verified Resend email and skips when email preference is disabled", async () => {
    const user = await createUser(app, { email: "resend-provider@example.test" });
    await app.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.user.id));
    await enablePreference(user.accessToken, "child_reminder", "email");
    const enabledLogId = await createDeliveryLog(user.profile.id, "email", {
      reminderTitle: "<script>Bez al</script>"
    });
    const disabledLogId = await createDeliveryLog(user.profile.id, "email");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "resend-email-1" }), { status: 200 }));

    const sent = await executeNotificationProviderDelivery(app, enabledLogId, {
      env: {
        NOTIFICATION_EMAIL_ENABLED: "true",
        NOTIFICATION_EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "secret-resend-key",
        RESEND_FROM_EMAIL: "no-reply@example.test",
        RESEND_FROM_NAME: "BabyLoop"
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: new Date("2030-01-01T10:00:00.000Z")
    });
    await enablePreference(user.accessToken, "child_reminder", "email", false);
    const skipped = await executeNotificationProviderDelivery(app, disabledLogId, {
      env: {
        NOTIFICATION_EMAIL_ENABLED: "true",
        NOTIFICATION_EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "secret-resend-key",
        RESEND_FROM_EMAIL: "no-reply@example.test"
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: new Date("2030-01-01T10:00:00.000Z")
    });
    const call = fetchImpl.mock.calls[0];
    const body = JSON.parse(String((call?.[1] as RequestInit).body)) as Record<string, unknown>;
    const sentLog = await getDeliveryLog(enabledLogId);
    const skippedLog = await getDeliveryLog(disabledLogId);

    expect(sent.status).toBe("sent");
    expect(skipped).toMatchObject({
      status: "skipped",
      reason: "preference_disabled"
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(call?.[0]).toBe("https://api.resend.com/emails");
    expect(String(body.html)).not.toContain("<script>");
    expect(sentLog).toMatchObject({
      provider: "resend",
      providerMessageId: "resend-email-1",
      status: "sent"
    });
    expect(skippedLog).toMatchObject({
      status: "skipped",
      skippedReason: "preference_disabled"
    });
    expect(JSON.stringify({ sentLog, skippedLog })).not.toMatch(/secret-resend-key|accessToken|refreshToken|passwordHash/iu);
  });

  it("sends privacy-safe marketplace email with an absolute action URL", async () => {
    const user = await createUser(app, { email: "marketplace-email@example.test" });
    await app.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.user.id));
    await enablePreference(user.accessToken, "messages", "email");
    const [row] = await app.db
      .insert(notificationDeliveryLogs)
      .values({
        profileId: user.profile.id,
        kind: "message_received",
        sourceType: "conversation",
        sourceId: randomUUID(),
        channel: "email",
        status: "candidate",
        idempotencyKey: `marketplace-provider-test:${randomUUID()}`,
        dedupKey: `marketplace-provider-test:${randomUUID()}`,
        frequencyWindowHours: 0,
        deliveryAllowed: true,
        draftOnly: false,
        blockedReasons: [],
        metadata: {
          actionHref: "/conversations/conversation-1",
          listingTitle: "<script>Ahşap oyuncak</script>",
          senderDisplayName: "Ece",
          rawBody: "private message contents"
        }
      })
      .returning({ id: notificationDeliveryLogs.id });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "resend-marketplace-1" }), { status: 200 }));

    const result = await executeNotificationProviderDelivery(app, row!.id, {
      env: {
        NOTIFICATION_EMAIL_ENABLED: "true",
        NOTIFICATION_EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "secret-resend-key",
        RESEND_FROM_EMAIL: "no-reply@example.test",
        WEB_APP_URL: "https://babyloop.example"
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: new Date("2030-01-01T10:00:00.000Z")
    });
    const body = JSON.parse(String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body)) as Record<string, unknown>;

    expect(result.status).toBe("sent");
    expect(body.subject).toBe("BabyLoop'ta yeni mesajın var");
    expect(body.text).toContain("https://babyloop.example/conversations/conversation-1");
    expect(String(body.html)).not.toContain("<script>");
    expect(JSON.stringify(body)).not.toContain("private message contents");
  });

  it("sends Expo push, revokes invalid tokens, and processes pending logs", async () => {
    process.env.PUSH_TOKEN_ENCRYPTION_KEY = "test-push-token-encryption-secret";
    const user = await createUser(app, { email: "push-provider@example.test" });
    await enablePreference(user.accessToken, "child_reminder", "push");
    await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/notifications/push-tokens",
      payload: {
        token: "ExponentPushToken[very-sensitive-device-token-value]",
        platform: "expo",
        deviceLabel: "Galaxy S22"
      }
    });
    const logId = await createDeliveryLog(user.profile.id, "push", {
      reminderTitle: "Oyun saati"
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { status: "error", details: { error: "DeviceNotRegistered" } }
      ]
    }), { status: 200 }));

    const summary = await processPendingNotificationProviderDeliveries(app, {
      env: {
        NOTIFICATION_PUSH_ENABLED: "true",
        PUSH_PROVIDER: "expo",
        EXPO_ACCESS_TOKEN: "secret-expo-token",
        EXPO_PUSH_API_BASE_URL: "https://exp.example.test/push"
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: new Date("2030-01-01T10:00:00.000Z")
    });
    const call = fetchImpl.mock.calls[0];
    const body = JSON.parse(String((call?.[1] as RequestInit).body)) as Array<Record<string, unknown>>;
    const log = await getDeliveryLog(logId);
    const tokens = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/notifications/push-tokens"
    });

    expect(summary).toMatchObject({
      processed: 1,
      sent: 1,
      providerCallsAllowed: true
    });
    expect(call?.[0]).toBe("https://exp.example.test/push");
    expect(body[0]).toMatchObject({
      to: "ExponentPushToken[very-sensitive-device-token-value]",
      data: {
        source: "child_reminder",
        deliveryLogId: logId
      }
    });
    expect(log).toMatchObject({
      status: "sent",
      provider: "expo",
      providerStatus: "sent"
    });
    expect(tokens.json().data.tokens).toHaveLength(0);
    expect(JSON.stringify(log)).not.toMatch(/very-sensitive-device-token|secret-expo-token|push-provider@example/iu);
  });

  async function createDeliveryLog(
    profileId: string,
    channel: "email" | "push" | "n8n",
    metadata: Record<string, unknown> = {},
    deliveryAllowed = true
  ): Promise<string> {
    const [row] = await app.db
      .insert(notificationDeliveryLogs)
      .values({
        profileId,
        kind: "child_reminder",
        sourceType: "child_profile",
        sourceId: randomUUID(),
        channel,
        status: "candidate",
        idempotencyKey: `provider-test:${channel}:${randomUUID()}`,
        dedupKey: `provider-test:${randomUUID()}`,
        frequencyWindowHours: 24,
        deliveryAllowed,
        draftOnly: !deliveryAllowed,
        blockedReasons: [],
        metadata: {
          childProfileId: "child-1",
          reminderId: "reminder-1",
          reminderTitle: "Bez al",
          ...metadata
        }
      })
      .returning({ id: notificationDeliveryLogs.id });

    if (!row) {
      throw new Error("Delivery log setup failed.");
    }

    return row.id;
  }

  async function enablePreference(
    accessToken: string,
    source: "child_reminder" | "messages" | "listing",
    channel: "email" | "push" | "n8n",
    enabled = true
  ): Promise<void> {
    const response = await app.inject({
      headers: authHeader(accessToken),
      method: "PATCH",
      url: "/api/v1/notification-preferences",
      payload: {
        source,
        channel,
        enabled
      }
    });

    expect(response.statusCode).toBe(200);
  }

  async function getDeliveryLog(id: string) {
    const [row] = await app.db
      .select()
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.id, id));

    if (!row) {
      throw new Error("Delivery log lookup failed.");
    }

    return row;
  }
});

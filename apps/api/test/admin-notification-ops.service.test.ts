import { notificationDeliveryLogs, runtimeWorkerHeartbeats } from "@babyloop/database/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { getAdminNotificationOpsPreview } from "../src/services/admin-notification-ops.service.js";

function sensitiveFixture(...parts: string[]): string {
  return parts.join("-");
}

describe("admin notification ops service", () => {
  let app: TestApp;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns aggregate delivery log preview without leaking sensitive keys", async () => {
    const user = await createUser(app, { email: "ops-preview-user@example.test" });

    await app.db.insert(runtimeWorkerHeartbeats).values({
      workerName: "notification_delivery",
      workerId: "notification-worker-test",
      status: "idle",
      lastCompletedAt: new Date("2030-01-01T10:03:00.000Z"),
      lastHeartbeatAt: new Date("2030-01-01T10:04:00.000Z")
    });

    await app.db.insert(notificationDeliveryLogs).values([
      {
        profileId: user.profile.id,
        kind: "saved_search",
        sourceType: "saved_search",
        sourceId: "saved-search-very-long-id:listing-very-long-id",
        channel: "in_app",
        status: "candidate",
        provider: null,
        providerStatus: null,
        idempotencyKey: sensitiveFixture("secret", "idempotency", "key", "1"),
        dedupKey: "secret-dedup-key-1",
        frequencyWindowHours: 24,
        deliveryAllowed: false,
        draftOnly: true,
        blockedReasons: ["delivery_disabled", "delivery_log_required"],
        metadata: {
          email: "parent@example.test",
          accessToken: "secret-token",
          rawBody: "raw-sensitive-payload-from-metadata"
        }
      },
      {
        profileId: user.profile.id,
        kind: "child_reminder",
        sourceType: "child_profile",
        sourceId: "reminder-1",
        channel: "email_draft",
        status: "blocked",
        provider: "resend",
        providerStatus: "retry_scheduled",
        providerMessageId: "resend-message-id-secret-long-value",
        attemptCount: 2,
        lastAttemptAt: new Date("2030-01-01T10:00:00.000Z"),
        nextAttemptAt: new Date("2030-01-01T10:05:00.000Z"),
        lastErrorCode: "resend_500",
        lastErrorMessageRedacted: "provider failed for [redacted-email]",
        idempotencyKey: sensitiveFixture("secret", "idempotency", "key", "2"),
        dedupKey: "secret-dedup-key-2",
        frequencyWindowHours: 24,
        deliveryAllowed: false,
        draftOnly: true,
        blockedReasons: ["frequency_window_active"],
        metadata: {
          cookie: "session-cookie",
          authorization: "Bearer secret"
        }
      },
      {
        profileId: user.profile.id,
        kind: "security",
        sourceType: "login_approval",
        sourceId: "login-approval-1",
        channel: "push",
        status: "processing",
        provider: "expo",
        providerStatus: "processing",
        claimToken: "secret-claim-token",
        claimedAt: new Date("2030-01-01T10:01:00.000Z"),
        claimExpiresAt: new Date("2030-01-01T10:06:00.000Z"),
        workerId: "notification-worker-1",
        idempotencyKey: sensitiveFixture("secret", "idempotency", "key", "3"),
        dedupKey: "secret-dedup-key-3",
        frequencyWindowHours: 1,
        deliveryAllowed: true,
        draftOnly: false,
        blockedReasons: [],
        metadata: {
          token: "secret-device-token"
        }
      },
      {
        profileId: user.profile.id,
        kind: "child_lifecycle",
        sourceType: "child_profile",
        sourceId: "child-lifecycle-sent-1",
        channel: "in_app",
        status: "sent",
        provider: "none",
        sentAt: new Date("2030-01-01T10:02:00.000Z"),
        idempotencyKey: sensitiveFixture("secret", "idempotency", "key", "4"),
        dedupKey: "secret-dedup-key-4",
        frequencyWindowHours: 24,
        deliveryAllowed: true,
        draftOnly: false,
        blockedReasons: []
      },
      {
        profileId: user.profile.id,
        kind: "saved_search",
        sourceType: "saved_search",
        sourceId: "saved-search-failed-1",
        channel: "push",
        status: "failed",
        provider: "expo",
        failedAt: new Date("2030-01-01T10:03:00.000Z"),
        nextAttemptAt: new Date("2030-01-01T10:08:00.000Z"),
        idempotencyKey: sensitiveFixture("secret", "idempotency", "key", "5"),
        dedupKey: "secret-dedup-key-5",
        frequencyWindowHours: 24,
        deliveryAllowed: true,
        draftOnly: false,
        blockedReasons: []
      }
    ]);

    const preview = await getAdminNotificationOpsPreview(app);
    const serialized = JSON.stringify(preview);

    expect(preview.summary).toEqual({
      status: "draft_only",
      draftOnly: true
    });
    expect(preview.n8nReadinessPreview).toMatchObject({
      deliveryAllowed: false,
      draftOnly: true,
      n8nWorkflowEnabled: false,
      webhookConfigured: false,
      webhookCallsAllowed: false,
      queueEnabled: false
    });
    expect(preview.pushReadinessPreview).toMatchObject({
      deliveryAllowed: false,
      draftOnly: true,
      pushSenderEnabled: false,
      providerConfigured: false,
      tokenRegistryEnabled: true,
      tokenCollectionAllowed: false
    });
    expect(preview.preferenceSummary).toMatchObject({
      deliveryProvidersEnabled: false,
      providerCallsAllowed: false,
      defaultEnabledChannels: ["in_app"],
      draftOnlyChannels: ["email", "push", "n8n", "sms"]
    });
    expect(preview.transitionPreview).toMatchObject({
      draftOnly: true,
      deliveryAllowed: false
    });
    expect(preview.transitionPreview.allowedDraftOnlyTransitions).toEqual(
      expect.arrayContaining([
        { from: "candidate", to: "skipped", reason: "draft_only_skip" }
      ])
    );

    expect(preview.deliveryLogPreview.totals).toMatchObject({
      all: 5,
      candidate: 1,
      processing: 1,
      blocked: 1,
      failed: 1,
      sent: 1
    });
    expect(preview.deliveryLogPreview.byKind).toEqual(
      expect.arrayContaining([
        { kind: "saved_search", count: 2 },
        { kind: "child_reminder", count: 1 }
      ])
    );
    expect(preview.deliveryLogPreview.byChannel).toEqual(
      expect.arrayContaining([
        { channel: "in_app", count: 2 },
        { channel: "email_draft", count: 1 }
      ])
    );
    expect(preview.deliveryLogPreview.recent).toHaveLength(5);
    expect(preview.deliveryLogPreview.recent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deliveryAllowed: false,
          draftOnly: true,
          provider: "resend",
          providerStatus: "retry_scheduled",
          attemptCount: 2,
          lastErrorCode: "resend_500"
        }),
        expect.objectContaining({
          status: "processing",
          provider: "expo",
          providerStatus: "processing",
          workerId: "notification-worker-1",
          claimedAt: "2030-01-01T10:01:00.000Z",
          claimExpiresAt: "2030-01-01T10:06:00.000Z"
        })
      ])
    );
    expect(preview.operationalHealth).toMatchObject({
      deadLetterCount: null,
      lastFailedDeliveryAt: "2030-01-01T10:03:00.000Z",
      lastSuccessfulDeliveryAt: "2030-01-01T10:02:00.000Z",
      retryScheduledCount: 1,
      worker: {
        lastCompletedAt: "2030-01-01T10:03:00.000Z",
        lastHeartbeatAt: "2030-01-01T10:04:00.000Z",
        status: "idle"
      }
    });
    expect(serialized).not.toMatch(/parent@example|ops-preview-user@example|secret-idempotency|secret-dedup|secret-token|session-cookie|Bearer secret|raw-sensitive-payload-from-metadata/iu);
    expect(serialized).not.toMatch(/secret-claim-token|secret-device-token/iu);
    expect(preview.warning).toContain("E-posta, anlık bildirim, n8n, kuyruk veya uygulama içi bildirim gönderimi yapmaz");
  });
});

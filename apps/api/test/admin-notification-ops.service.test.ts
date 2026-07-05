import { notificationDeliveryLogs } from "@babyloop/database/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { getAdminNotificationOpsPreview } from "../src/services/admin-notification-ops.service.js";

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

    await app.db.insert(notificationDeliveryLogs).values([
      {
        profileId: user.profile.id,
        kind: "saved_search",
        sourceType: "saved_search",
        sourceId: "saved-search-very-long-id:listing-very-long-id",
        channel: "in_app",
        status: "candidate",
        idempotencyKey: "secret-idempotency-key-1",
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
        idempotencyKey: "secret-idempotency-key-2",
        dedupKey: "secret-dedup-key-2",
        frequencyWindowHours: 24,
        deliveryAllowed: false,
        draftOnly: true,
        blockedReasons: ["frequency_window_active"],
        metadata: {
          cookie: "session-cookie",
          authorization: "Bearer secret"
        }
      }
    ]);

    const preview = await getAdminNotificationOpsPreview(app);
    const serialized = JSON.stringify(preview);

    expect(preview.summary).toEqual({
      status: "draft_only",
      draftOnly: true
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
      all: 2,
      candidate: 1,
      blocked: 1
    });
    expect(preview.deliveryLogPreview.byKind).toEqual(
      expect.arrayContaining([
        { kind: "saved_search", count: 1 },
        { kind: "child_reminder", count: 1 }
      ])
    );
    expect(preview.deliveryLogPreview.byChannel).toEqual(
      expect.arrayContaining([
        { channel: "in_app", count: 1 },
        { channel: "email_draft", count: 1 }
      ])
    );
    expect(preview.deliveryLogPreview.recent).toHaveLength(2);
    expect(preview.deliveryLogPreview.recent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deliveryAllowed: false,
          draftOnly: true
        })
      ])
    );
    expect(serialized).not.toMatch(/parent@example|ops-preview-user@example|secret-idempotency|secret-dedup|secret-token|session-cookie|Bearer secret|raw-sensitive-payload-from-metadata/iu);
    expect(preview.warning).toContain("Email, push, n8n, queue veya in-app notification gönderimi yapmaz");
  });
});

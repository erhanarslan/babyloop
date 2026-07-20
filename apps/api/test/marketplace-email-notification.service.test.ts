import { notificationDeliveryLogs } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMarketplaceEmailNotificationCandidate } from "../src/services/marketplace-email-notification.service.js";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

const enabledEmailEnv = {
  NOTIFICATION_EMAIL_ENABLED: "true",
  NOTIFICATION_EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "test-resend-key",
  RESEND_FROM_EMAIL: "no-reply@example.test"
};

describe("marketplace email notification candidates", () => {
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

  it("does not queue email unless both provider configuration and user preference allow it", async () => {
    const user = await createUser(app, { email: "marketplace-preference@example.test" });
    const input = {
      actionHref: "/conversations/conversation-1",
      kind: "message_received" as const,
      metadata: {
        senderDisplayName: "Ada",
        rawBody: "This must never be persisted"
      },
      profileId: user.profile.id,
      sourceId: "message-1"
    };

    expect(await createMarketplaceEmailNotificationCandidate(app, input, {})).toMatchObject({
      status: "provider_disabled",
      deliveryLogId: null
    });
    expect(await createMarketplaceEmailNotificationCandidate(app, input, enabledEmailEnv)).toMatchObject({
      status: "preference_disabled",
      deliveryLogId: null
    });

    await updatePreference(user.accessToken, "messages", true);
    const created = await createMarketplaceEmailNotificationCandidate(app, input, enabledEmailEnv);
    const duplicate = await createMarketplaceEmailNotificationCandidate(app, input, enabledEmailEnv);
    const rows = await app.db
      .select()
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, user.profile.id));

    expect(created.status).toBe("created");
    expect(duplicate.status).toBe("duplicate");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "message_received",
      sourceType: "conversation",
      channel: "email",
      status: "candidate",
      deliveryAllowed: true,
      draftOnly: false
    });
    expect(rows[0]?.metadata).toMatchObject({
      actionHref: "/conversations/conversation-1",
      senderDisplayName: "Ada"
    });
    expect(JSON.stringify(rows)).not.toContain("This must never be persisted");
  });

  it("uses the listing email preference independently from message email", async () => {
    const user = await createUser(app, { email: "favorite-preference@example.test" });
    await updatePreference(user.accessToken, "listing", true);

    const result = await createMarketplaceEmailNotificationCandidate(app, {
      actionHref: "/listings/listing-1",
      kind: "listing_favorited",
      metadata: { listingTitle: "Ahşap oyuncak" },
      profileId: user.profile.id,
      sourceId: "favorite-notification-1"
    }, enabledEmailEnv);

    expect(result.status).toBe("created");
  });

  async function updatePreference(
    accessToken: string,
    source: "messages" | "listing",
    enabled: boolean
  ): Promise<void> {
    const response = await app.inject({
      headers: authHeader(accessToken),
      method: "PATCH",
      url: "/api/v1/notification-preferences",
      payload: {
        source,
        channel: "email",
        enabled
      }
    });

    expect(response.statusCode).toBe(200);
  }
});

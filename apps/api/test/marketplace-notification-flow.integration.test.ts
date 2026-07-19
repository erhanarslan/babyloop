import { notificationDeliveryLogs, users } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeNotificationProviderDelivery } from "../src/services/notification-provider-execution.service.js";
import { authHeader, createUser } from "./helpers/auth.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createConversation, createListing } from "./helpers/fixtures.js";

const enabledEmailEnv = {
  NOTIFICATION_EMAIL_ENABLED: "true",
  NOTIFICATION_EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "test-resend-key",
  RESEND_FROM_EMAIL: "no-reply@example.test",
  RESEND_FROM_NAME: "BabyLoop",
  WEB_APP_URL: "https://babyloop.example"
};

describe("marketplace notification email flow", () => {
  let app: TestApp;
  const previousEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const [key, value] of Object.entries(enabledEmailEnv)) {
      previousEnv[key] = process.env[key];
      process.env[key] = value;
    }

    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    for (const key of Object.keys(enabledEmailEnv)) {
      const previous = previousEnv[key];

      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }

    if (app) {
      await app.close();
    }
  });

  it("queues and sends privacy-safe email for a new message and a listing favorite", async () => {
    const seller = await createUser(app, {
      displayName: "Seller",
      email: "marketplace-flow-seller@example.test",
      locationCity: "İstanbul"
    });
    const buyer = await createUser(app, {
      displayName: "Buyer",
      email: "marketplace-flow-buyer@example.test",
      locationCity: "Ankara"
    });
    await app.db
      .update(users)
      .set({ emailVerifiedAt: new Date("2030-01-01T09:00:00.000Z") })
      .where(eq(users.id, seller.user.id));
    await enableEmailPreference(seller.accessToken, "messages");
    await enableEmailPreference(seller.accessToken, "listing");

    const listing = await createListing(app, seller.accessToken, {
      title: "Güvenli ahşap oyuncak"
    });
    const conversationResponse = await createConversation(app, buyer.accessToken, listing.id);
    const conversationId = conversationResponse.json().data.conversation.id as string;
    const rawPrivateMessage = "Merhaba, teslimat ayrıntısını özel olarak konuşalım.";
    const messageResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversationId}/messages`,
      payload: { body: rawPrivateMessage }
    });
    const favoriteResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: { listingId: listing.id }
    });
    const candidateLogs = await app.db
      .select()
      .from(notificationDeliveryLogs)
      .where(eq(notificationDeliveryLogs.profileId, seller.profile.id));
    const marketplaceLogs = candidateLogs.filter((log) => (
      log.kind === "message_received" || log.kind === "listing_favorited"
    ));

    expect(messageResponse.statusCode).toBe(201);
    expect(favoriteResponse.statusCode).toBe(201);
    expect(marketplaceLogs).toHaveLength(2);
    expect(new Set(marketplaceLogs.map((log) => log.kind))).toEqual(
      new Set(["message_received", "listing_favorited"])
    );
    expect(JSON.stringify(marketplaceLogs)).not.toContain(rawPrivateMessage);
    expect(JSON.stringify(marketplaceLogs)).not.toContain(buyer.user.email);

    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ id: `resend-marketplace-${fetchImpl.mock.calls.length}` }),
      { status: 200 }
    ));
    const results = [];

    for (const log of marketplaceLogs) {
      results.push(await executeNotificationProviderDelivery(app, log.id, {
        env: enabledEmailEnv,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        now: new Date("2030-01-01T10:00:00.000Z")
      }));
    }

    const bodies = fetchImpl.mock.calls.map((call) => (
      JSON.parse(String((call[1] as RequestInit).body)) as Record<string, unknown>
    ));

    expect(results.map((result) => result.status)).toEqual(["sent", "sent"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(new Set(bodies.map((body) => body.subject))).toEqual(new Set([
      "BabyLoop'ta yeni mesajın var",
      "İlanın BabyLoop'ta favoriye eklendi"
    ]));
    expect(JSON.stringify(bodies)).not.toContain(rawPrivateMessage);
    expect(JSON.stringify(bodies)).not.toContain(buyer.user.email);
    expect(JSON.stringify(bodies)).not.toContain("test-resend-key");
  });

  async function enableEmailPreference(
    accessToken: string,
    source: "messages" | "listing"
  ): Promise<void> {
    const response = await app.inject({
      headers: authHeader(accessToken),
      method: "PATCH",
      url: "/api/v1/notification-preferences",
      payload: {
        source,
        channel: "email",
        enabled: true
      }
    });

    expect(response.statusCode).toBe(200);
  }
});

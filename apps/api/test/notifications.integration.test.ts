import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listings, notifications } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import {
  emitUnreadNotificationCountUpdated,
  publishNotificationCreated,
  toNotificationCreatedPayload
} from "../src/realtime/publisher.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { authHeader, createUser } from "./helpers/auth.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createConversation, createListing } from "./helpers/fixtures.js";

let app!: TestApp;

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

describe("notifications API", () => {
  it("requires auth to list notifications", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/notifications"
    });

    expect(response.statusCode).toBe(401);
  });

  it("creates a recipient notification when a message is sent", async () => {
    const seller = await createUser(app, { displayName: "Seller" });
    const buyer = await createUser(app, { displayName: "Buyer" });
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    const sendResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Merhaba, ürün hala satılık mı?"
      }
    });
    const sellerNotifications = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications"
    });
    const buyerNotifications = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/notifications"
    });
    const sellerUnread = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications/unread-count"
    });

    expect(sendResponse.statusCode).toBe(201);
    expect(sellerNotifications.statusCode).toBe(200);
    expect(sellerNotifications.json().data.notifications).toHaveLength(1);
    expect(sellerNotifications.json().data.notifications[0]).toMatchObject({
      actorProfile: {
        id: buyer.profile.id,
        displayName: "Buyer"
      },
      entityId: conversation.id,
      entityType: "conversation",
      type: "message_received"
    });
    expect(sellerNotifications.json().data.notifications[0].metadata).toMatchObject({
      listingId: listing.id,
      messageId: sendResponse.json().data.message.id
    });
    expect(buyerNotifications.json().data.notifications).toHaveLength(0);
    expect(sellerUnread.json().data.count).toBe(1);
  });

  it("does not create or emit notification for a moderated blocked message", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;
    const emitSpy = vi.spyOn(app.realtime!.io, "to");

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "I will kill you"
      }
    });
    const sellerNotifications = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "MESSAGE_BLOCKED"
      }
    });
    expect(sellerNotifications.json().data.notifications).toHaveLength(0);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("creates a listing owner notification when a listing is favorited once", async () => {
    const seller = await createUser(app, { displayName: "Owner" });
    const buyer = await createUser(app, { displayName: "Favorite Actor" });
    const listing = await createListing(app, seller.accessToken, {
      title: "Clean stroller"
    });

    const firstFavorite = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const duplicateFavorite = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const sellerNotifications = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications"
    });
    const buyerNotifications = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/notifications"
    });

    expect(firstFavorite.statusCode).toBe(201);
    expect(duplicateFavorite.statusCode).toBe(200);
    expect(sellerNotifications.json().data.notifications).toHaveLength(1);
    expect(sellerNotifications.json().data.notifications[0]).toMatchObject({
      actorProfile: null,
      body: "Someone favorited your listing.",
      entityId: listing.id,
      entityType: "listing",
      title: "Listing favorited",
      type: "listing_favorited"
    });
    expect(sellerNotifications.json().data.notifications[0].metadata).toMatchObject({
      source: "favorite_added"
    });
    expect(sellerNotifications.body).not.toContain("Favorite Actor");
    expect(buyerNotifications.json().data.notifications).toHaveLength(0);
  });

  it("sanitizes legacy favorite notifications so actor identity is not exposed", async () => {
    const seller = await createUser(app, {
      displayName: "Seller Privacy",
      email: "seller-privacy@babyloop.test"
    });
    const buyer = await createUser(app, {
      displayName: "Ayse Private Actor",
      email: "ayse-private-actor@babyloop.test"
    });
    const listing = await createListing(app, seller.accessToken, {
      title: "Wooden Montessori toy set"
    });

    await app.db.insert(notifications).values({
      recipientProfileId: seller.profile.id,
      actorProfileId: buyer.profile.id,
      type: "listing_favorited",
      title: `${buyer.profile.displayName} favorited Wooden Montessori toy set.`,
      body: `${buyer.user.email} favorited your listing as profile ${buyer.profile.id}.`,
      entityType: "listing",
      entityId: listing.id,
      metadata: {
        actorProfileId: buyer.profile.id,
        actorUserId: buyer.user.id,
        actorEmail: buyer.user.email,
        actorDisplayName: buyer.profile.displayName,
        source: "legacy_test"
      }
    });

    const sellerNotifications = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications"
    });
    const [notification] = sellerNotifications.json().data.notifications;
    const serializedNotification = JSON.stringify(notification);

    expect(sellerNotifications.statusCode).toBe(200);
    expect(notification).toMatchObject({
      actorProfile: null,
      body: "Someone favorited your listing.",
      entityId: listing.id,
      entityType: "listing",
      title: "Listing favorited",
      type: "listing_favorited"
    });
    expect(serializedNotification).not.toContain(buyer.profile.displayName);
    expect(serializedNotification).not.toContain(buyer.user.email);
    expect(serializedNotification).not.toContain(buyer.profile.id);
    expect(serializedNotification).not.toContain(buyer.user.id);
    expect(notification.metadata).toMatchObject({
      source: "legacy_test"
    });
  });

  it("does not store unsafe listing title text in favorite notifications", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken, {
      title: "Safe initial title"
    });
    await app.db
      .update(listings)
      .set({
        title: "<script>alert(1)</script>"
      })
      .where(eq(listings.id, listing.id));

    const favoriteResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const sellerNotifications = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications"
    });
    const [notification] = sellerNotifications.json().data.notifications;

    expect(favoriteResponse.statusCode).toBe(201);
    expect(notification.body).toBe("Someone favorited your listing.");
    expect(JSON.stringify(notification.metadata)).not.toContain("<script");
    expect(sellerNotifications.body).not.toContain("<script");
  });

  it("marks one notification read and then marks all notifications read", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Is pickup possible today?"
      }
    });
    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const listResponse = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications"
    });
    const notifications = listResponse.json().data.notifications;

    const readResponse = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/notifications/${notifications[0].id}/read`
    });
    const unreadAfterOne = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications/unread-count"
    });
    const readAllResponse = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: "/api/v1/notifications/read-all"
    });
    const unreadAfterAll = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications/unread-count"
    });

    expect(notifications).toHaveLength(2);
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json().data.notification.readAt).not.toBeNull();
    expect(unreadAfterOne.json().data.count).toBe(1);
    expect(readAllResponse.statusCode).toBe(200);
    expect(readAllResponse.json().data.updatedCount).toBe(1);
    expect(unreadAfterAll.json().data.count).toBe(0);
  });

  it("does not allow a user to mark another profile's notification read", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const sellerNotifications = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications"
    });
    const notificationId = sellerNotifications.json().data.notifications[0].id;

    const buyerRead = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "PATCH",
      url: `/api/v1/notifications/${notificationId}/read`
    });
    const sellerUnread = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications/unread-count"
    });

    expect(buyerRead.statusCode).toBe(404);
    expect(sellerUnread.json().data.count).toBe(1);
  });

  it("returns 400 for invalid notification ids", async () => {
    const user = await createUser(app);
    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "PATCH",
      url: "/api/v1/notifications/not-a-uuid/read"
    });

    expect(response.statusCode).toBe(400);
  });

  it("keeps notification realtime publishers best-effort", async () => {
    const user = await createUser(app);
    vi.spyOn(app.realtime!.io, "to").mockImplementation(() => {
      throw new Error("socket unavailable");
    });

    expect(() =>
      emitUnreadNotificationCountUpdated(app, user.profile.id, {
        unreadCount: 1
      })
    ).not.toThrow();
    await expect(
      publishNotificationCreated(app, user.profile.id, toNotificationCreatedPayload({
        id: "99999999-9999-4999-8999-999999999999",
        recipientProfileId: user.profile.id,
        actorProfile: null,
        type: "system",
        title: "System",
        body: "Hello",
        entityType: null,
        entityId: null,
        metadata: {},
        readAt: null,
        createdAt: new Date().toISOString()
      }, 1))
    ).resolves.toBeUndefined();
  });
});

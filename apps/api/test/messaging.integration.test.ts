import {
  aiModelRuns,
  authAccounts,
  conversationParticipants,
  conversations,
  emailVerificationTokens,
  favorites,
  listingImages,
  listings,
  messages,
  mfaOtpChallenges,
  notifications,
  passwordResetTokens,
  profiles,
  sessions,
  users
} from "@babyloop/database/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REALTIME_EVENTS,
  realtimeConversationRoom,
  realtimeProfileRoom,
  type ConversationUpdatedPayload,
  type MessageCreatedPayload,
  type RealtimeErrorPayload
} from "@babyloop/shared";
import { REFRESH_TOKEN_COOKIE_NAME, hashRefreshToken } from "../src/utils/refresh-token.js";
import { hashEmailVerificationToken } from "../src/utils/email-verification-token.js";
import { hashMfaOtpCode } from "../src/utils/mfa-otp.js";
import { GOOGLE_OAUTH_STATE_COOKIE_NAME, type GoogleUserInfo } from "../src/services/google-oauth.service.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { authHeader, createUser, loginUser } from "./helpers/auth.js";
import { countEvents, createCategory, createConversation, createListing, getListingSellerProfileId } from "./helpers/fixtures.js";
import { getCookieValue, getDevResetToken, getGoogleOAuthStateSetCookie, getRefreshSetCookie, toCookieHeader } from "./helpers/cookies.js";
import { createRecordingEmailDeliveryService, type RecordingEmailDeliveryService } from "./helpers/email.js";
import { createFakeGoogleOAuthClient } from "./helpers/google-oauth.js";
import { connectRealtimeSocket, delay, expectUnauthenticatedSocketRejected, getListeningBaseUrl, onceSocketEvent, waitForConversationRoomSize } from "./helpers/realtime.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

describe("messaging API", () => {
  it("returns 401 for unauthenticated conversation create", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        listingId: listing.id
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects conversation create for sold and archived listings", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const archivedListing = await createListing(app, seller.accessToken);
    const soldListing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, archivedListing.id));
    await app.db
      .update(listings)
      .set({ status: "sold" })
      .where(eq(listings.id, soldListing.id));

    const archivedResponse = await createConversation(app, buyer.accessToken, archivedListing.id);
    const soldResponse = await createConversation(app, buyer.accessToken, soldListing.id);

    expect(archivedResponse.statusCode).toBe(400);
    expect(archivedResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_LISTING"
      }
    });
    expect(soldResponse.statusCode).toBe(400);
    expect(soldResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_LISTING"
      }
    });
  });

  it("allows conversation create for reserved listings", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "reserved" })
      .where(eq(listings.id, listing.id));

    const response = await createConversation(app, buyer.accessToken, listing.id);

    expect(response.statusCode).toBe(201);
    expect(response.json().data.conversation.contextListing).toMatchObject({
      id: listing.id
    });
  });

  it("rejects invalid conversation listingId and extra profile fields", async () => {
    const buyer = await createUser(app);
    const invalidListingId = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        listingId: "not-a-uuid"
      }
    });
    const extraFields = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        buyerProfileId: buyer.profile.id,
        listingId: "99999999-9999-4999-8999-999999999999",
        profileHighId: buyer.profile.id,
        profileLowId: buyer.profile.id,
        sellerProfileId: buyer.profile.id
      }
    });

    expect(invalidListingId.statusCode).toBe(400);
    expect(extraFields.statusCode).toBe(400);
    expect(extraFields.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("accepts listingId and prevents seller messaging own listing", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const buyerResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        listingId: listing.id
      }
    });
    const sellerResponse = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        listingId: listing.id
      }
    });

    expect(buyerResponse.statusCode).toBe(201);
    expect(sellerResponse.statusCode).toBe(400);
    expect(sellerResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "CANNOT_MESSAGE_SELF"
      }
    });
  });

  it("reuses the same conversation for the same two profiles", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const first = await createConversation(app, buyer.accessToken, listing.id);
    const second = await createConversation(app, buyer.accessToken, listing.id);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.conversation.id).toBe(first.json().data.conversation.id);
  });

  it("requires auth to list conversations and returns only current user's conversations", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const otherSeller = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const otherListing = await createListing(app, otherSeller.accessToken);
    const buyerConversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;
    const outsiderConversation = (await createConversation(app, outsider.accessToken, otherListing.id)).json().data.conversation;

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/conversations"
    });
    const buyerList = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/conversations"
    });
    const conversationIds = buyerList.json().data.conversations.map(
      (conversation: { id: string }) => conversation.id
    );

    expect(unauthenticated.statusCode).toBe(401);
    expect(buyerList.statusCode).toBe(200);
    expect(conversationIds).toContain(buyerConversation.id);
    expect(conversationIds).not.toContain(outsiderConversation.id);
  });

  it("returns one conversation summary for participants only", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    const participant = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}`
    });
    const nonParticipant = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}`
    });
    const missing = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/conversations/99999999-9999-4999-8999-999999999999"
    });

    expect(participant.statusCode).toBe(200);
    expect(participant.json()).toMatchObject({
      ok: true,
      data: {
        conversation: {
          id: conversation.id,
          contextListing: {
            id: listing.id
          }
        }
      }
    });
    expect(nonParticipant.statusCode).toBe(403);
    expect(missing.statusCode).toBe(404);
  });

  it("allows participants to send messages and blocks non-participants", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    const participantMessage = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Is this still available?"
      }
    });
    const outsiderMessage = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "I should not be here."
      }
    });

    expect(participantMessage.statusCode).toBe(201);
    expect(outsiderMessage.statusCode).toBe(403);
  });

  it("requires auth to list messages and blocks non-participants from reading thread", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Participant-only message"
      }
    });

    const unauthenticated = await app.inject({
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}/messages`
    });
    const outsiderRead = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}/messages`
    });
    const participantRead = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}/messages`
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(outsiderRead.statusCode).toBe(403);
    expect(participantRead.statusCode).toBe(200);
    expect(participantRead.json().data.messages).toHaveLength(1);
  });

  it("rejects blank messages and updates lastMessageAt on send", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    const blank = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "   "
      }
    });
    const sent = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Can we arrange pickup?"
      }
    });
    const listed = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/conversations"
    });

    expect(blank.statusCode).toBe(400);
    expect(sent.statusCode).toBe(201);
    expect(listed.json().data.conversations[0].lastMessageAt).toEqual(expect.any(String));
    expect(listed.json().data.conversations[0].latestMessage).toMatchObject({
      body: "Can we arrange pickup?",
      senderProfileId: buyer.profile.id,
      createdAt: expect.any(String)
    });

    const [row] = await app.db
      .select({
        lastMessageAt: conversations.lastMessageAt
      })
      .from(conversations)
      .where(eq(conversations.id, conversation.id))
      .limit(1);

    expect(row?.lastMessageAt).toBeInstanceOf(Date);
  });

  it("marks incoming conversation messages and related notifications read when the recipient opens the thread", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    const sendResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Is this still available?"
      }
    });
    const sellerConversationsBeforeOpen = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/conversations"
    });
    const buyerConversationsAfterSend = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/conversations"
    });
    const sellerNotificationCountBeforeOpen = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications/unread-count"
    });

    expect(sendResponse.statusCode).toBe(201);
    expect(sellerConversationsBeforeOpen.json().data.conversations[0]).toMatchObject({
      id: conversation.id,
      unreadCount: 1
    });
    expect(buyerConversationsAfterSend.json().data.conversations[0]).toMatchObject({
      id: conversation.id,
      unreadCount: 0
    });
    expect(sellerNotificationCountBeforeOpen.json().data.count).toBe(1);

    const openThread = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}/messages`
    });
    const sellerConversationsAfterOpen = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/conversations"
    });
    const sellerNotificationCountAfterOpen = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/notifications/unread-count"
    });
    const [sellerParticipant] = await app.db
      .select({ lastReadAt: conversationParticipants.lastReadAt })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversation.id),
          eq(conversationParticipants.profileId, seller.profile.id)
        )
      );
    const [messageNotification] = await app.db
      .select({ readAt: notifications.readAt })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientProfileId, seller.profile.id),
          eq(notifications.entityType, "conversation"),
          eq(notifications.entityId, conversation.id)
        )
      );

    expect(openThread.statusCode).toBe(200);
    expect(openThread.json().data.messages).toHaveLength(1);
    expect(openThread.json().data.readState).toMatchObject({
      unreadConversationCount: 0,
      unreadNotificationCount: 0
    });
    expect(sellerParticipant?.lastReadAt).toBeInstanceOf(Date);
    expect(messageNotification?.readAt).toBeInstanceOf(Date);
    expect(sellerConversationsAfterOpen.json().data.conversations[0]).toMatchObject({
      id: conversation.id,
      unreadCount: 0
    });
    expect(sellerNotificationCountAfterOpen.json().data.count).toBe(0);
  });

  it("rejects dangerous HTML/script-like message bodies before persistence or realtime", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;
    const emitSpy = vi.spyOn(app.realtime!.io, "to");

    const scriptResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "<script>alert(1)</script>"
      }
    });
    const imageHandlerResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "<img src=x onerror=alert(1)>"
      }
    });
    const javascriptProtocolResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "javascript:alert(1)"
      }
    });
    const persistedMessages = await app.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, conversation.id));
    const createdNotifications = await app.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.entityId, conversation.id));

    for (const response of [scriptResponse, imageHandlerResponse, javascriptProtocolResponse]) {
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        ok: false,
        error: {
          code: "INVALID_MESSAGE_BODY"
        }
      });
    }
    expect(persistedMessages).toHaveLength(0);
    expect(createdNotifications).toHaveLength(0);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("accepts valid Turkish and multiline plaintext messages", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Merhaba, ürün hâlâ satılık mı?\nUygunsa bugün alabilirim."
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.message.body).toBe(
      "Merhaba, ürün hâlâ satılık mı?\nUygunsa bugün alabilirim."
    );
  });

  it("does not leak latestMessage conversation summaries to outsiders", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Private latest message"
      }
    });

    const outsiderList = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "GET",
      url: "/api/v1/conversations"
    });
    const outsiderDirectRead = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}`
    });

    expect(outsiderList.statusCode).toBe(200);
    expect(outsiderList.json().data.conversations).toHaveLength(0);
    expect(outsiderList.body).not.toContain("Private latest message");
    expect(outsiderDirectRead.statusCode).toBe(403);
  });

  it("keeps existing conversations readable after the listing is sold or archived", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    await app.db
      .update(listings)
      .set({ status: "sold" })
      .where(eq(listings.id, listing.id));

    const soldConversation = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}`
    });

    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, listing.id));

    const archivedMessages = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}/messages`
    });

    expect(soldConversation.statusCode).toBe(200);
    expect(soldConversation.json().data.conversation).toMatchObject({
      id: conversation.id,
      contextListing: {
        id: listing.id
      }
    });
    expect(archivedMessages.statusCode).toBe(200);
  });
});

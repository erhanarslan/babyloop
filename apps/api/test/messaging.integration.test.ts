import {
  aiModelRuns,
  authAccounts,
  conversations,
  emailVerificationTokens,
  favorites,
  listingImages,
  listings,
  mfaOtpChallenges,
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

  it("rejects conversation create for inactive listing", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, listing.id));

    const response = await createConversation(app, buyer.accessToken, listing.id);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_LISTING"
      }
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
});

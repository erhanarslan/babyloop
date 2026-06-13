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
import { PUBLIC_ACCESS_TOKEN_COOKIE_NAME } from "../src/utils/public-access-token-cookie.js";
import { hashEmailVerificationToken } from "../src/utils/email-verification-token.js";
import { hashMfaOtpCode } from "../src/utils/mfa-otp.js";
import { GOOGLE_OAUTH_STATE_COOKIE_NAME, type GoogleUserInfo } from "../src/services/google-oauth.service.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { authHeader, createUser, loginUser } from "./helpers/auth.js";
import { countEvents, createCategory, createConversation, createListing, getListingSellerProfileId } from "./helpers/fixtures.js";
import { getCookieValue, getDevResetToken, getGoogleOAuthStateSetCookie, getRefreshSetCookie, toCookieHeader, getSetCookieHeaders } from "./helpers/cookies.js";
import { createRecordingEmailDeliveryService, type RecordingEmailDeliveryService } from "./helpers/email.js";
import { createFakeGoogleOAuthClient } from "./helpers/google-oauth.js";
import { connectRealtimeSocket, connectRealtimeSocketWithCookie, delay, disconnectSockets, expectUnauthenticatedSocketRejected, getListeningBaseUrl, onceSocketEvent, waitForConversationRoomSize } from "./helpers/realtime.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

describe("messaging realtime API", () => {
  it("accepts socket authentication from the public access cookie", async () => {
    await app.listen({ host: "127.0.0.1", port: 0 });
    const apiBaseUrl = getListeningBaseUrl(app);

    await createUser(app, {
      email: "realtime-cookie-auth@example.com",
      password: "Password123!"
    });

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "realtime-cookie-auth@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/login"
    });
    const publicAccessCookie = getPublicAccessSetCookie(loginResponse);
    const socket = await connectRealtimeSocketWithCookie(apiBaseUrl, toCookieHeader(publicAccessCookie));

    expect(socket.connected).toBe(true);

    disconnectSockets(socket);
  });
  it("publishes realtime events after message persistence", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;
    const emit = vi.fn();
    const to = vi.spyOn(app.realtime!.io, "to").mockReturnValue({
      emit
    } as never);

    const sent = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Merhaba, urun hala satilik mi?"
      }
    });
    const persistedMessages = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}/messages`
    });

    expect(sent.statusCode).toBe(201);
    expect(persistedMessages.json().data.messages).toHaveLength(1);
    expect(to).toHaveBeenCalledWith(realtimeConversationRoom(conversation.id));
    expect(to).toHaveBeenCalledWith(realtimeProfileRoom(seller.profile.id));
    expect(to).toHaveBeenCalledWith(realtimeProfileRoom(buyer.profile.id));
    expect(emit).toHaveBeenCalledWith(
      REALTIME_EVENTS.messageCreated,
      expect.objectContaining({
        conversationId: conversation.id,
        message: expect.objectContaining({
          body: "Merhaba, urun hala satilik mi?"
        })
      })
    );
    expect(emit).toHaveBeenCalledWith(
      REALTIME_EVENTS.conversationUpdated,
      expect.objectContaining({
        conversationId: conversation.id,
        conversation: expect.objectContaining({
          latestMessage: expect.objectContaining({
            body: "Merhaba, urun hala satilik mi?"
          })
        })
      })
    );
  });

  it("delivers persisted messages over a live Socket.IO runtime", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(app, buyer.accessToken, listing.id)).json().data.conversation;

    await app.listen({
      host: "127.0.0.1",
      port: 0
    });
    const apiBaseUrl = getListeningBaseUrl(app);

    await expectUnauthenticatedSocketRejected(apiBaseUrl);

    const sellerSocket = await connectRealtimeSocket(apiBaseUrl, seller.accessToken);
    const buyerSocket = await connectRealtimeSocket(apiBaseUrl, buyer.accessToken);
    const outsiderSocket = await connectRealtimeSocket(apiBaseUrl, outsider.accessToken);

    try {
      const outsiderJoinError = onceSocketEvent<RealtimeErrorPayload>(
        outsiderSocket,
        REALTIME_EVENTS.realtimeError
      );

      outsiderSocket.emit(REALTIME_EVENTS.conversationJoin, {
        conversationId: conversation.id
      });

      expect(await outsiderJoinError).toMatchObject({
        code: "FORBIDDEN"
      });

      sellerSocket.emit(REALTIME_EVENTS.conversationJoin, {
        conversationId: conversation.id
      });
      buyerSocket.emit(REALTIME_EVENTS.conversationJoin, {
        conversationId: conversation.id
      });
      await waitForConversationRoomSize(app, conversation.id, 2);

      const messageCreated = onceSocketEvent<MessageCreatedPayload>(
        sellerSocket,
        REALTIME_EVENTS.messageCreated
      );
      const sellerConversationUpdated = onceSocketEvent<ConversationUpdatedPayload>(
        sellerSocket,
        REALTIME_EVENTS.conversationUpdated
      );
      const buyerConversationUpdated = onceSocketEvent<ConversationUpdatedPayload>(
        buyerSocket,
        REALTIME_EVENTS.conversationUpdated
      );

      const sent = await app.inject({
        headers: authHeader(buyer.accessToken),
        method: "POST",
        url: `/api/v1/conversations/${conversation.id}/messages`,
        payload: {
          body: "Merhaba, urun hala satilik mi?"
        }
      });
      const [createdPayload, sellerUpdatePayload, buyerUpdatePayload] = await Promise.all([
        messageCreated,
        sellerConversationUpdated,
        buyerConversationUpdated
      ]);
      const persistedMessages = await app.inject({
        headers: authHeader(buyer.accessToken),
        method: "GET",
        url: `/api/v1/conversations/${conversation.id}/messages`
      });

      expect(sellerSocket.connected).toBe(true);
      expect(buyerSocket.connected).toBe(true);
      expect(sent.statusCode).toBe(201);
      expect(persistedMessages.statusCode).toBe(200);
      expect(persistedMessages.json().data.messages).toHaveLength(1);
      expect(createdPayload).toMatchObject({
        conversationId: conversation.id,
        message: {
          body: "Merhaba, urun hala satilik mi?",
          conversationId: conversation.id,
          sender: {
            id: buyer.profile.id
          }
        }
      });
      expect(sellerUpdatePayload).toMatchObject({
        conversationId: conversation.id,
        conversation: {
          latestMessage: {
            body: "Merhaba, urun hala satilik mi?",
            senderProfileId: buyer.profile.id
          }
        }
      });
      expect(buyerUpdatePayload).toMatchObject({
        conversationId: conversation.id,
        conversation: {
          latestMessage: {
            body: "Merhaba, urun hala satilik mi?",
            senderProfileId: buyer.profile.id
          }
        }
      });

      const blockedEvents: MessageCreatedPayload[] = [];
      const blockedEventHandler = (payload: MessageCreatedPayload) => {
        blockedEvents.push(payload);
      };

      sellerSocket.on(REALTIME_EVENTS.messageCreated, blockedEventHandler);

      try {
        const blocked = await app.inject({
          headers: authHeader(buyer.accessToken),
          method: "POST",
          url: `/api/v1/conversations/${conversation.id}/messages`,
          payload: {
            body: "f.u.c.k you"
          }
        });

        await delay(100);

        const messagesAfterBlocked = await app.inject({
          headers: authHeader(buyer.accessToken),
          method: "GET",
          url: `/api/v1/conversations/${conversation.id}/messages`
        });

        expect(blocked.statusCode).toBe(400);
        expect(messagesAfterBlocked.json().data.messages).toHaveLength(1);
        expect(blockedEvents).toHaveLength(0);
      } finally {
        sellerSocket.off(REALTIME_EVENTS.messageCreated, blockedEventHandler);
      }
    } finally {
      disconnectSockets(sellerSocket, buyerSocket, outsiderSocket);
    }


    expect(sellerSocket.connected).toBe(false);
    expect(buyerSocket.connected).toBe(false);
    expect(outsiderSocket.connected).toBe(false);
  });

});

function getPublicAccessSetCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const accessCookie = getSetCookieHeaders(response).find((header) =>
    header.startsWith(`${PUBLIC_ACCESS_TOKEN_COOKIE_NAME}=`)
  );

  if (!accessCookie) {
    throw new Error("Public access cookie was not set.");
  }

  return accessCookie;
}

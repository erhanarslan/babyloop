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

describe("favorites API", () => {
  it("returns 401 for unauthenticated favorite action", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("accepts listingId body and rejects old listing_id body", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const okResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    const oldContractResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listing_id: listing.id
      }
    });

    expect(okResponse.statusCode).toBe(201);
    expect(oldContractResponse.statusCode).toBe(400);
  });

  it("rejects favoriting own listing without logging an event", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const favoriteAddedEvents = await countEvents(app.db, "favorite_added", listing.id);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "CANNOT_FAVORITE_OWN_LISTING"
      }
    });
    expect(favoriteAddedEvents).toBe(0);
  });

  it("rejects favoriting inactive listings", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, listing.id));

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "LISTING_NOT_ACTIVE"
      }
    });
  });

  it("handles duplicate favorite idempotently and removes favorite", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const first = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const duplicate = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const removed = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "DELETE",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const removedAgain = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "DELETE",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const favoriteAddedEvents = await countEvents(app.db, "favorite_added", listing.id);
    const favoriteRemovedEvents = await countEvents(app.db, "favorite_removed", listing.id);

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().data.created).toBe(false);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().data.removed).toBe(true);
    expect(removedAgain.statusCode).toBe(200);
    expect(removedAgain.json().data.removed).toBe(false);
    expect(favoriteAddedEvents).toBe(1);
    expect(favoriteRemovedEvents).toBe(1);
  });

  it("requires auth to list favorites", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/favorites"
    });

    expect(response.statusCode).toBe(401);
  });

  it("lists only current user's favorites", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const otherBuyer = await createUser(app);
    const buyerListing = await createListing(app, seller.accessToken, {
      title: "Buyer favorite listing"
    });
    const otherBuyerListing = await createListing(app, seller.accessToken, {
      title: "Other buyer favorite listing"
    });

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: buyerListing.id
      }
    });
    await app.inject({
      headers: authHeader(otherBuyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: otherBuyerListing.id
      }
    });

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/favorites"
    });
    const favoriteIds = response.json().data.favorites.map((favorite: { id: string }) => favorite.id);

    expect(response.statusCode).toBe(200);
    expect(favoriteIds).toContain(buyerListing.id);
    expect(favoriteIds).not.toContain(otherBuyerListing.id);
  });

  it("cannot delete someone else's favorite by listingId", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const otherBuyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const response = await app.inject({
      headers: authHeader(otherBuyer.accessToken),
      method: "DELETE",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const remainingFavorites = await app.db
      .select({
        id: favorites.id
      })
      .from(favorites)
      .where(and(eq(favorites.profileId, buyer.profile.id), eq(favorites.listingId, listing.id)));
    const favoriteRemovedEvents = await countEvents(app.db, "favorite_removed", listing.id);

    expect(response.statusCode).toBe(200);
    expect(response.json().data.removed).toBe(false);
    expect(remainingFavorites).toHaveLength(1);
    expect(favoriteRemovedEvents).toBe(0);
  });

  it("keeps profile favorites route self-only", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const otherBuyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    const own = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: `/api/v1/profiles/${buyer.profile.id}/favorites`
    });
    const other = await app.inject({
      headers: authHeader(otherBuyer.accessToken),
      method: "GET",
      url: `/api/v1/profiles/${buyer.profile.id}/favorites`
    });

    expect(own.statusCode).toBe(200);
    expect(own.json().data.favorites.map((favorite: { id: string }) => favorite.id)).toContain(listing.id);
    expect(other.statusCode).toBe(403);
  });
});

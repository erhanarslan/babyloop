import { aiModelRuns, conversations, events, listings } from "@babyloop/database/schema";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authHeader,
  createCategory,
  createListing,
  createUser,
  loginUser
} from "./api-helpers.js";
import { createTestApp } from "./test-app.js";
import { resetTestDatabase } from "./test-db.js";

let app: FastifyInstance | undefined;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("auth API", () => {
  it("registers a valid user", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Ada Parent",
        email: "  ADA@Example.COM  ",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        user: {
          email: "ada@example.com"
        },
        profile: {
          displayName: "Ada Parent"
        }
      }
    });
    expect(response.json().data.accessToken).toEqual(expect.any(String));
    expect(response.body).not.toContain("passwordHash");
  });

  it("rejects duplicate email", async () => {
    const user = await createUser(app, { email: "duplicate@example.com" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Duplicate",
        email: user.user.email,
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "EMAIL_ALREADY_REGISTERED"
      }
    });
  });

  it("rejects duplicate normalized email", async () => {
    await createUser(app, { email: "Parent@Example.com" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Duplicate Normalized",
        email: " parent@example.COM ",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "EMAIL_ALREADY_REGISTERED"
      }
    });
  });

  it("logs in a valid user", async () => {
    await createUser(app, {
      email: "login@example.com",
      password: "Password123!"
    });

    const login = await loginUser(app, " LOGIN@Example.COM ", "Password123!");

    expect(login.accessToken).toEqual(expect.any(String));
    expect(login.user.email).toBe("login@example.com");
  });

  it("rejects invalid password", async () => {
    await createUser(app, {
      email: "wrong-password@example.com",
      password: "Password123!"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "wrong-password@example.com",
        password: "WrongPassword"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CREDENTIALS"
      }
    });
  });

  it("returns auth/me with a valid token", async () => {
    const user = await createUser(app);
    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/auth/me"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        user: {
          id: user.user.id
        },
        profile: {
          id: user.profile.id
        }
      }
    });
  });

  it("returns 401 for auth/me without token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me"
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 401 for auth/me with an invalid token", async () => {
    const response = await app.inject({
      headers: authHeader("not-a-valid-token"),
      method: "GET",
      url: "/api/v1/auth/me"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("rate limits auth login attempts", async () => {
    await app?.close();
    app = await createTestApp({
      authRateLimitMax: 1,
      authRateLimitWindowSeconds: 60
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "missing@example.com",
        password: "Password123!"
      }
    });
    const limited = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "missing@example.com",
        password: "Password123!"
      }
    });

    expect(first.statusCode).toBe(401);
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      ok: false,
      error: {
        code: "RATE_LIMITED"
      }
    });
  });
});

describe("listings API", () => {
  it("publicly lists active listings", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: listing.id
        })
      ])
    );
  });

  it("does not publicly list inactive listings", async () => {
    const seller = await createUser(app);
    const activeListing = await createListing(app, seller.accessToken);
    const archivedListing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, archivedListing.id));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });
    const listingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(listingIds).toContain(activeListing.id);
    expect(listingIds).not.toContain(archivedListing.id);
  });

  it("publicly returns active listing detail", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        listing: {
          id: listing.id,
          seller: {
            id: seller.profile.id
          }
        }
      }
    });
  });

  it("does not publicly return inactive listing detail", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, listing.id));

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 401 for unauthenticated listing creation", async () => {
    const category = await createCategory(app.db);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        title: "Unauthenticated listing"
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("creates a listing for authenticated user", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    expect(listing.id).toEqual(expect.any(String));
  });

  it("rejects client seller profile spoofing", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        sellerProfileId: "10000000-0000-4000-8000-000000000001",
        title: "Spoofed seller listing"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("returns 401 for unauthenticated current user listings", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me/listings"
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns only listings owned by the authenticated user", async () => {
    const owner = await createUser(app);
    const otherUser = await createUser(app);
    const ownerActiveListing = await createListing(app, owner.accessToken);
    const ownerArchivedListing = await createListing(app, owner.accessToken);
    const otherListing = await createListing(app, otherUser.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, ownerArchivedListing.id));

    const response = await app.inject({
      headers: authHeader(owner.accessToken),
      method: "GET",
      url: "/api/v1/me/listings"
    });
    const ownedListingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(ownedListingIds).toContain(ownerActiveListing.id);
    expect(ownedListingIds).toContain(ownerArchivedListing.id);
    expect(ownedListingIds).not.toContain(otherListing.id);
  });
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
    const favoriteAddedEvents = await countEvents("favorite_added", listing.id);

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
    const favoriteAddedEvents = await countEvents("favorite_added", listing.id);
    const favoriteRemovedEvents = await countEvents("favorite_removed", listing.id);

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

    const first = await createConversation(buyer.accessToken, listing.id);
    const second = await createConversation(buyer.accessToken, listing.id);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.conversation.id).toBe(first.json().data.conversation.id);
  });

  it("returns one conversation summary for participants only", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

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
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

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

  it("rejects blank messages and updates lastMessageAt on send", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

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

    const [row] = await app.db
      .select({
        lastMessageAt: conversations.lastMessageAt
      })
      .from(conversations)
      .where(eq(conversations.id, conversation.id))
      .limit(1);

    expect(row?.lastMessageAt).toBeInstanceOf(Date);
  });
});

describe("AI listing suggestion API", () => {
  it("returns mock suggestion and logs ai_model_runs", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/listing-suggestions",
      payload: {
        categoryName: "Strollers",
        condition: "good",
        title: "Bugaboo stroller"
      }
    });
    const rows = await app.db
      .select({
        feature: aiModelRuns.feature,
        status: aiModelRuns.status
      })
      .from(aiModelRuns);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        suggestion: {
          providerName: "mock-listing-suggestion"
        }
      }
    });
    expect(rows).toEqual([
      {
        feature: "listing_suggestion",
        status: "success"
      }
    ]);
  });
});

async function createConversation(token: string, listingId: string) {
  return app.inject({
    headers: authHeader(token),
    method: "POST",
    url: "/api/v1/conversations",
    payload: {
      listingId
    }
  });
}

async function countEvents(eventType: string, entityId: string): Promise<number> {
  const rows = await app.db
    .select({
      id: events.id
    })
    .from(events)
    .where(and(eq(events.eventType, eventType), eq(events.entityId, entityId)));

  return rows.length;
}

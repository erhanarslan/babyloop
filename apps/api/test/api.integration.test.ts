import {
  aiModelRuns,
  authAccounts,
  conversations,
  events,
  favorites,
  listingImages,
  listings,
  profiles,
  users
} from "@babyloop/database/schema";
import { and, asc, eq } from "drizzle-orm";
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

  it("trims and normalizes registered email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Email Normalized",
        email: "  Mixed.Case@Example.COM  ",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.user.email).toBe("mixed.case@example.com");
  });

  it("creates a password auth account on register", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Account Linked",
        email: "  Account.Linked@Example.COM  ",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(201);
    const registeredUser = response.json().data.user;
    const login = await loginUser(app, "account.linked@example.com", "Password123!");
    const accountRows = await app.db
      .select({
        email: authAccounts.email,
        provider: authAccounts.provider,
        providerAccountId: authAccounts.providerAccountId,
        userId: authAccounts.userId
      })
      .from(authAccounts)
      .where(eq(authAccounts.userId, registeredUser.id));

    expect(login.user.id).toBe(registeredUser.id);
    expect(accountRows).toEqual([
      {
        email: "account.linked@example.com",
        provider: "password",
        providerAccountId: "account.linked@example.com",
        userId: registeredUser.id
      }
    ]);
  });

  it("rolls back user and profile when password auth account creation fails", async () => {
    const existingUser = await createUser(app, { email: "existing-account-owner@example.com" });
    const conflictEmail = "conflict@example.com";
    await app.db.insert(authAccounts).values({
      email: conflictEmail,
      provider: "password",
      providerAccountId: conflictEmail,
      userId: existingUser.user.id
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Rollback Candidate",
        email: conflictEmail,
        password: "Password123!"
      }
    });
    const userRows = await app.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, conflictEmail));
    const profileRows = await app.db
      .select({ id: profiles.id })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(eq(users.email, conflictEmail));
    const accountRows = await app.db
      .select({
        provider: authAccounts.provider,
        providerAccountId: authAccounts.providerAccountId,
        userId: authAccounts.userId
      })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, "password"),
          eq(authAccounts.providerAccountId, conflictEmail)
        )
      );

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(userRows).toHaveLength(0);
    expect(profileRows).toHaveLength(0);
    expect(accountRows).toEqual([
      {
        provider: "password",
        providerAccountId: conflictEmail,
        userId: existingUser.user.id
      }
    ]);
  });

  it("rejects invalid register email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Invalid Email",
        email: "not-an-email",
        password: "Password123!"
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

  it("rejects short register password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Short Password",
        email: "short-password@example.com",
        password: "short"
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

    const accountRows = await app.db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(eq(authAccounts.email, "duplicate@example.com"));

    expect(accountRows).toHaveLength(1);
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

    const accountRows = await app.db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(eq(authAccounts.email, "parent@example.com"));

    expect(accountRows).toHaveLength(1);
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

  it("normalizes login email", async () => {
    await createUser(app, {
      email: "normalized-login@example.com",
      password: "Password123!"
    });

    const login = await loginUser(app, "  NORMALIZED-LOGIN@Example.COM  ", "Password123!");

    expect(login.user.email).toBe("normalized-login@example.com");
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
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("password_hash");
    expect(response.body).not.toContain("authAccounts");
    expect(response.body).not.toContain("providerAccountId");
    expect(response.body).not.toContain("provider_account_id");
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

  it("rejects listing creation with unknown categoryId", async () => {
    const seller = await createUser(app);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: "99999999-9999-4999-8999-999999999999",
        condition: "good",
        listingType: "sale",
        title: "Unknown category listing"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CATEGORY"
      }
    });
  });

  it("rejects invalid listing image URLs and more than five image URLs", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const invalidUrl = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        imageUrls: ["not-a-url"],
        listingType: "sale",
        title: "Invalid image URL listing"
      }
    });
    const tooManyUrls = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        imageUrls: [
          "https://example.com/1.jpg",
          "https://example.com/2.jpg",
          "https://example.com/3.jpg",
          "https://example.com/4.jpg",
          "https://example.com/5.jpg",
          "https://example.com/6.jpg"
        ],
        listingType: "sale",
        title: "Too many image URLs listing"
      }
    });

    expect(invalidUrl.statusCode).toBe(400);
    expect(tooManyUrls.statusCode).toBe(400);
  });

  it("creates a listing for authenticated user", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    expect(listing.id).toEqual(expect.any(String));
  });

  it("creates listings for active MVP listing types", async () => {
    const seller = await createUser(app);
    const sale = await createListing(app, seller.accessToken, {
      listingType: "sale",
      title: "Sale listing"
    });
    const donation = await createListing(app, seller.accessToken, {
      listingType: "donation",
      title: "Donation listing"
    });
    const swap = await createListing(app, seller.accessToken, {
      listingType: "swap",
      title: "Swap listing"
    });

    expect(sale.id).toEqual(expect.any(String));
    expect(donation.id).toEqual(expect.any(String));
    expect(swap.id).toEqual(expect.any(String));
  });

  it("rejects rent listing creation because rentals are deferred from MVP scope", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        listingType: "rent",
        title: "Rental listing should be rejected"
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

  it("stores listing images in sortOrder order", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const imageUrls = [
      "https://example.com/first.jpg",
      "https://example.com/second.jpg",
      "https://example.com/third.jpg"
    ];
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        imageUrls,
        listingType: "sale",
        title: "Ordered image listing"
      }
    });
    const listingId = response.json().data.listing.id;
    const images = await app.db
      .select({
        sortOrder: listingImages.sortOrder,
        url: listingImages.url
      })
      .from(listingImages)
      .where(eq(listingImages.listingId, listingId))
      .orderBy(asc(listingImages.sortOrder));

    expect(response.statusCode).toBe(201);
    expect(images).toEqual([
      { sortOrder: 0, url: imageUrls[0] },
      { sortOrder: 1, url: imageUrls[1] },
      { sortOrder: 2, url: imageUrls[2] }
    ]);
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

  it("rejects invalid listingType, invalid condition, and unknown extra fields", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const basePayload = {
      categoryId: category.id,
      condition: "good",
      listingType: "sale",
      title: "Invalid contract listing"
    };

    const invalidListingType = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        ...basePayload,
        listingType: "auction"
      }
    });
    const invalidCondition = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        ...basePayload,
        condition: "excellent"
      }
    });
    const extraFields = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        ...basePayload,
        sellerProfileId: seller.profile.id,
        status: "archived"
      }
    });

    expect(invalidListingType.statusCode).toBe(400);
    expect(invalidCondition.statusCode).toBe(400);
    expect(extraFields.statusCode).toBe(400);
    expect(extraFields.json()).toMatchObject({
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

  it("does not expose internal seller user id in public listing list", async () => {
    const seller = await createUser(app);
    await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(seller.user.id);
    expect(response.body).not.toContain("userId");
    expect(response.body).not.toContain("user_id");
  });

  it("does not expose password hash or user email in listing detail", async () => {
    const seller = await createUser(app, { email: "seller-private@example.com" });
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("password_hash");
    expect(response.body).not.toContain("seller-private@example.com");
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
    const favoriteRemovedEvents = await countEvents("favorite_removed", listing.id);

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

    const response = await createConversation(buyer.accessToken, listing.id);

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

    const first = await createConversation(buyer.accessToken, listing.id);
    const second = await createConversation(buyer.accessToken, listing.id);

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
    const buyerConversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;
    const outsiderConversation = (await createConversation(outsider.accessToken, otherListing.id)).json().data.conversation;

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

  it("requires auth to list messages and blocks non-participants from reading thread", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

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

  it("trims message body and rejects overlong message body", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

    const trimmed = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "  Trimmed message  "
      }
    });
    const overlong = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "a".repeat(5001)
      }
    });

    expect(trimmed.statusCode).toBe(201);
    expect(trimmed.json().data.message.body).toBe("Trimmed message");
    expect(overlong.statusCode).toBe(400);
    expect(overlong.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("does not leak latestMessage conversation summaries to outsiders", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

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
    expect(rows).toHaveLength(1);
    expect(rows).toEqual([
      {
        feature: "listing_suggestion",
        status: "success"
      }
    ]);
  });

  it("rejects invalid listing suggestion payload without inserting a successful ai_model_runs row", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/listing-suggestions",
      payload: {
        title: ""
      }
    });
    const successRows = await app.db
      .select({
        id: aiModelRuns.id
      })
      .from(aiModelRuns)
      .where(eq(aiModelRuns.status, "success"));

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
    expect(successRows).toHaveLength(0);
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

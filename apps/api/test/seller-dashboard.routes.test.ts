import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createListing, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("seller dashboard routes", () => {
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

  it("requires auth for seller dashboard", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/seller/dashboard"
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns current seller aggregates without leaking buyer identity", async () => {
    const seller = await createUser(app, { email: "seller-dashboard@example.test" });
    const buyer = await createUser(app, {
      displayName: "Private Buyer",
      email: "buyer-dashboard@example.test"
    });
    const listing = await createListing(app, seller.accessToken, {
      title: "Satıcı dashboard bebek arabası"
    });

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/seller/dashboard"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        summary: {
          totals: {
            totalListings: 1,
            activeListings: 1,
            totalFavorites: 1
          },
          listings: [
            {
              listingId: listing.id,
              title: "Satıcı dashboard bebek arabası",
              favoriteCount: 1
            }
          ]
        }
      }
    });
    expect(response.body).not.toContain(buyer.user.email);
    expect(response.body).not.toContain("Private Buyer");
    expect(response.body).not.toContain(buyer.profile.id);
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("accessToken");
    expect(response.body).not.toContain("refreshToken");
  });

  it("does not expose another seller's listing summary", async () => {
    const seller = await createUser(app);
    const otherSeller = await createUser(app);
    await createListing(app, seller.accessToken, {
      title: "My listing"
    });
    await createListing(app, otherSeller.accessToken, {
      title: "Other seller listing"
    });

    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/seller/dashboard"
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("My listing");
    expect(response.body).not.toContain("Other seller listing");
  });
});

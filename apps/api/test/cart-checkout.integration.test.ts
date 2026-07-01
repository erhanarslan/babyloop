import { cartItems, listings } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { authHeader, createUser } from "./helpers/auth.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createListing } from "./helpers/fixtures.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("cart and mock iyzico checkout API", () => {
  it("requires authentication for cart endpoints", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/cart"
    });

    expect(response.statusCode).toBe(401);
  });

  it("adds an active sale listing to the buyer cart and returns it", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken, {
      title: "Temiz bebek arabası",
      priceAmount: "5800.00"
    });

    const addResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: listing.id }
    });
    const cartResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/cart"
    });

    expect(addResponse.statusCode).toBe(200);
    expect(cartResponse.statusCode).toBe(200);
    expect(cartResponse.json().data.cart).toMatchObject({
      subtotal: {
        amount: "5800.00",
        currency: "TRY"
      },
      items: [
        {
          listing: {
            id: listing.id,
            title: "Temiz bebek arabası",
            status: "active",
            listingType: "sale"
          }
        }
      ]
    });
    expect(JSON.stringify(cartResponse.json())).not.toMatch(/password|accessToken|refreshToken|phone|email/iu);
  });

  it("rejects adding the seller's own listing to cart", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: listing.id }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("CANNOT_ADD_OWN_LISTING_TO_CART");
  });

  it("rejects archived or sold listings for cart", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const archivedListing = await createListing(app, seller.accessToken);

    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, archivedListing.id));

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: archivedListing.id }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("LISTING_UNAVAILABLE_FOR_CART");
  });

  it("keeps duplicate add idempotent with one cart row", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: listing.id }
    });
    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: listing.id }
    });

    const rows = await app.db
      .select({ id: cartItems.id })
      .from(cartItems)
      .where(eq(cartItems.listingId, listing.id));

    expect(rows).toHaveLength(1);
  });

  it("checks out successfully, marks listing sold, and clears cart", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken, {
      priceAmount: "1250.00"
    });

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: listing.id }
    });

    const checkoutResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/checkout/mock-iyzico",
      payload: { scenario: "success" }
    });
    const [listingRow] = await app.db
      .select({ status: listings.status })
      .from(listings)
      .where(eq(listings.id, listing.id));
    const cartResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/cart"
    });

    expect(checkoutResponse.statusCode).toBe(200);
    expect(checkoutResponse.json().data.checkout).toMatchObject({
      status: "paid",
      paidAmount: "1250.00",
      currency: "TRY",
      items: [
        {
          listingId: listing.id,
          listingType: "sale"
        }
      ]
    });
    expect(checkoutResponse.json().data.checkout.orderId).toEqual(expect.any(String));
    expect(checkoutResponse.json().data.checkout.mockIyzicoPaymentId).toMatch(/^mock-iyzico-/u);
    expect(listingRow?.status).toBe("sold");
    expect(cartResponse.json().data.cart.items).toHaveLength(0);
  });

  it("keeps cart and listing state when mock checkout fails", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: listing.id }
    });

    const checkoutResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/checkout/mock-iyzico",
      payload: { scenario: "failure" }
    });
    const [listingRow] = await app.db
      .select({ status: listings.status })
      .from(listings)
      .where(eq(listings.id, listing.id));
    const cartResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/cart"
    });

    expect(checkoutResponse.statusCode).toBe(402);
    expect(checkoutResponse.json().error.code).toBe("MOCK_IYZICO_PAYMENT_FAILED");
    expect(listingRow?.status).toBe("active");
    expect(cartResponse.json().data.cart.items).toHaveLength(1);
  });

  it("does not allow a sold listing to be checked out again", async () => {
    const seller = await createUser(app);
    const firstBuyer = await createUser(app);
    const secondBuyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(firstBuyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: listing.id }
    });
    await app.inject({
      headers: authHeader(firstBuyer.accessToken),
      method: "POST",
      url: "/api/v1/checkout/mock-iyzico",
      payload: { scenario: "success" }
    });

    const addAgainResponse = await app.inject({
      headers: authHeader(secondBuyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: listing.id }
    });

    expect(addAgainResponse.statusCode).toBe(409);
    expect(addAgainResponse.json().error.code).toBe("LISTING_UNAVAILABLE_FOR_CART");
  });
});

import { cartItems, events, listings } from "@babyloop/database/schema";
import { and, eq } from "drizzle-orm";
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

    const [cartAddedEvent] = await app.db
      .select({
        actorProfileId: events.actorProfileId,
        entityId: events.entityId,
        entityType: events.entityType,
        eventType: events.eventType,
        metadata: events.metadata
      })
      .from(events)
      .where(and(eq(events.entityId, listing.id), eq(events.eventType, "product_cart_item_added")));

    expect(cartAddedEvent).toMatchObject({
      actorProfileId: buyer.profile.id,
      entityId: listing.id,
      entityType: "listing",
      eventType: "product_cart_item_added"
    });
    expect(cartAddedEvent?.metadata).toEqual({
      listingId: listing.id,
      result: "added",
      source: "server_cart"
    });
    expect(JSON.stringify(cartAddedEvent)).not.toMatch(/password|accessToken|refreshToken|phone|email|providerPaymentId/iu);
  });

  it("returns a lightweight cart summary for global header badges", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const availableListing = await createListing(app, seller.accessToken, {
      title: "Available summary stroller"
    });
    const unavailableListing = await createListing(app, seller.accessToken, {
      title: "Unavailable summary carrier"
    });

    for (const listing of [availableListing, unavailableListing]) {
      await app.inject({
        headers: authHeader(buyer.accessToken),
        method: "POST",
        url: "/api/v1/cart/items",
        payload: { listingId: listing.id }
      });
    }

    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, unavailableListing.id));

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/cart/summary"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        summary: {
          itemCount: 1,
          unavailableItemCount: 1
        }
      }
    });
    expect(response.body).not.toContain("listing");
    expect(response.body).not.toContain("price");
    expect(response.body).not.toContain("image");
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

  it("rejects demo listings at the backend commerce boundary", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    await app.db.update(listings).set({
      isDemo: true,
      demoSeedKey: "test:demo-cart",
      demoSeedVersion: "test.v1"
    }).where(eq(listings.id, listing.id));

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: listing.id }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("DEMO_LISTING_COMMERCE_DISABLED");
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

  it("records privacy-safe cart remove and clear product events", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const firstListing = await createListing(app, seller.accessToken, {
      title: "Cart remove event stroller"
    });
    const secondListing = await createListing(app, seller.accessToken, {
      title: "Cart clear event carrier"
    });

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: firstListing.id }
    });
    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId: secondListing.id }
    });

    const removeResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "DELETE",
      url: `/api/v1/cart/items/${firstListing.id}`
    });
    const clearResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "DELETE",
      url: "/api/v1/cart"
    });

    expect(removeResponse.statusCode).toBe(200);
    expect(clearResponse.statusCode).toBe(200);

    const [removedEvent] = await app.db
      .select({
        actorProfileId: events.actorProfileId,
        entityId: events.entityId,
        entityType: events.entityType,
        eventType: events.eventType,
        metadata: events.metadata
      })
      .from(events)
      .where(and(eq(events.entityId, firstListing.id), eq(events.eventType, "product_cart_item_removed")));

    const [clearedEvent] = await app.db
      .select({
        actorProfileId: events.actorProfileId,
        entityId: events.entityId,
        entityType: events.entityType,
        eventType: events.eventType,
        metadata: events.metadata
      })
      .from(events)
      .where(and(eq(events.entityId, buyer.profile.id), eq(events.eventType, "product_cart_cleared")));

    expect(removedEvent).toMatchObject({
      actorProfileId: buyer.profile.id,
      entityId: firstListing.id,
      entityType: "listing",
      eventType: "product_cart_item_removed"
    });
    expect(removedEvent?.metadata).toEqual({
      listingId: firstListing.id,
      source: "server_cart"
    });

    expect(clearedEvent).toMatchObject({
      actorProfileId: buyer.profile.id,
      entityId: buyer.profile.id,
      entityType: "cart",
      eventType: "product_cart_cleared"
    });
    expect(clearedEvent?.metadata).toEqual({
      itemCount: 1,
      source: "server_cart"
    });

    expect(JSON.stringify({ removedEvent, clearedEvent })).not.toMatch(/password|accessToken|refreshToken|phone|email|providerPaymentId/iu);
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
    expect(checkoutResponse.json().data.checkout.paymentAttempt).toMatchObject({
      provider: "mock_iyzico",
      providerMode: "simulation",
      status: "succeeded",
      livePayment: false,
      realMoneyMovement: false,
      capturedAmount: "1250.00"
    });
    expect(JSON.stringify(checkoutResponse.json())).not.toMatch(/cardNumber|cvv|apiKey|secret|authorization|cookie/iu);
    expect(listingRow?.status).toBe("sold");
    expect(cartResponse.json().data.cart.items).toHaveLength(0);

    const [checkoutEvent] = await app.db
      .select({
        actorProfileId: events.actorProfileId,
        entityId: events.entityId,
        entityType: events.entityType,
        eventType: events.eventType,
        metadata: events.metadata
      })
      .from(events)
      .where(and(eq(events.entityId, listing.id), eq(events.eventType, "product_mock_checkout_succeeded")));

    expect(checkoutEvent).toMatchObject({
      actorProfileId: buyer.profile.id,
      entityId: listing.id,
      entityType: "listing",
      eventType: "product_mock_checkout_succeeded"
    });
    expect(checkoutEvent?.metadata).toMatchObject({
      itemCount: 1,
      listingId: listing.id,
      paidAmount: "1250.00",
      paymentProvider: "mock_iyzico",
      source: "server_checkout"
    });
    expect(JSON.stringify(checkoutEvent)).not.toMatch(/password|accessToken|refreshToken|phone|email|providerPaymentId/iu);
  });

  it("keeps cart and listing state when mock checkout fails", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken, {
      priceAmount: "5800.00"
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

    const [checkoutFailedEvent] = await app.db
      .select({
        actorProfileId: events.actorProfileId,
        entityId: events.entityId,
        entityType: events.entityType,
        eventType: events.eventType,
        metadata: events.metadata
      })
      .from(events)
      .where(and(eq(events.entityId, buyer.profile.id), eq(events.eventType, "product_mock_checkout_failed")));

    expect(checkoutFailedEvent).toMatchObject({
      actorProfileId: buyer.profile.id,
      entityId: buyer.profile.id,
      entityType: "cart",
      eventType: "product_mock_checkout_failed"
    });
    expect(checkoutFailedEvent?.metadata).toEqual({
      checkoutMode: "simulation",
      commissionAmount: "116.00",
      itemCount: 1,
      paymentProvider: "mock_iyzico",
      realMoneyMovement: "false",
      reason: "mock_failure",
      source: "server_checkout",
      totalAmount: "5800.00"
    });
    expect(JSON.stringify(checkoutFailedEvent)).not.toMatch(/password|accessToken|refreshToken|phone|email|providerPaymentId/iu);
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

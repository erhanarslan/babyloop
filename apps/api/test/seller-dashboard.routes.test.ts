import { events, listings } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createListing, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

type ListingLifecycleStatus = "active" | "reserved" | "sold" | "archived";

type SellerDashboardSummary = {
  totals: {
    totalListings: number;
    activeListings: number;
    reservedListings: number;
    soldListings: number;
    archivedListings: number;
    totalFavorites: number;
    listingDetailViews: number;
    listingClicks: number;
    contactSellerIntents: number;
  };
  listings: Array<{
    listingId: string;
    title: string;
    status: ListingLifecycleStatus;
    categoryName: string;
    categorySlug: string;
    createdAt: string;
    favoriteCount: number;
    detailViews: number;
    listingClicks: number;
    contactSellerIntents: number;
  }>;
};

type SellerDashboardResponse = {
  ok: true;
  data: {
    summary: SellerDashboardSummary;
  };
};

const BUYER_EMAIL_SENTINEL = "private-buyer-dashboard@example.test";
const OTHER_BUYER_EMAIL_SENTINEL = "other-private-buyer-dashboard@example.test";
const BUYER_DISPLAY_NAME_SENTINEL = "Private Buyer Dashboard";
const RAW_MESSAGE_SENTINEL = "RAW_SELLER_DASHBOARD_MESSAGE_SHOULD_NOT_LEAK";
const RAW_PHONE_SENTINEL = "+905551112233";

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

  it("returns an empty privacy-safe dashboard for a seller without listings", async () => {
    const seller = await createUser(app, {
      email: "empty-seller-dashboard@example.test"
    });

    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/seller/dashboard"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        summary: {
          totals: {
            totalListings: 0,
            activeListings: 0,
            reservedListings: 0,
            soldListings: 0,
            archivedListings: 0,
            totalFavorites: 0,
            listingDetailViews: 0,
            listingClicks: 0,
            contactSellerIntents: 0
          },
          listings: []
        }
      }
    });
    expectNoSensitiveDashboardLeak(response.body, {
      accessToken: seller.accessToken,
      buyerEmail: seller.user.email,
      buyerDisplayName: seller.profile.displayName,
      buyerProfileId: seller.profile.id
    });
  });

  it("returns current seller aggregates without leaking buyer identity or another seller's metrics", async () => {
    const seller = await createUser(app, {
      email: "seller-dashboard@example.test"
    });
    const buyer = await createUser(app, {
      displayName: BUYER_DISPLAY_NAME_SENTINEL,
      email: BUYER_EMAIL_SENTINEL
    });
    const otherBuyer = await createUser(app, {
      displayName: "Other Private Buyer Dashboard",
      email: OTHER_BUYER_EMAIL_SENTINEL
    });
    const otherSeller = await createUser(app, {
      displayName: "Other Seller Dashboard",
      email: "other-seller-dashboard@example.test"
    });

    const activeListing = await createListing(app, seller.accessToken, {
      title: "Satıcı dashboard aktif bebek arabası"
    });
    const reservedListing = await createListing(app, seller.accessToken, {
      title: "Satıcı dashboard rezerve oto koltuğu"
    });
    const soldListing = await createListing(app, seller.accessToken, {
      title: "Satıcı dashboard satıldı mama sandalyesi"
    });
    const archivedListing = await createListing(app, seller.accessToken, {
      title: "Satıcı dashboard arşiv oyun halısı"
    });
    const otherSellerListing = await createListing(app, otherSeller.accessToken, {
      title: "Other seller listing must not leak into dashboard"
    });

    await setListingStatus(reservedListing.id, "reserved");
    await setListingStatus(soldListing.id, "sold");
    await setListingStatus(archivedListing.id, "archived");

    await addFavorite(buyer.accessToken, activeListing.id);
    await addFavorite(otherBuyer.accessToken, activeListing.id);
    await addFavorite(buyer.accessToken, reservedListing.id);
    await addFavorite(buyer.accessToken, otherSellerListing.id);

    await insertProductEvents({
      actorProfileId: buyer.profile.id,
      count: 2,
      eventType: "product_listing_detail_viewed",
      listingId: activeListing.id
    });
    await insertProductEvents({
      actorProfileId: buyer.profile.id,
      count: 1,
      eventType: "product_listing_card_clicked",
      listingId: activeListing.id
    });
    await insertProductEvents({
      actorProfileId: otherBuyer.profile.id,
      count: 1,
      eventType: "product_recently_viewed_listing_clicked",
      listingId: activeListing.id
    });
    await insertProductEvents({
      actorProfileId: buyer.profile.id,
      count: 1,
      eventType: "product_contact_seller_intent",
      listingId: activeListing.id
    });
    await insertProductEvents({
      actorProfileId: otherBuyer.profile.id,
      count: 1,
      eventType: "product_listing_detail_viewed",
      listingId: reservedListing.id
    });
    await insertProductEvents({
      actorProfileId: buyer.profile.id,
      count: 2,
      eventType: "product_contact_seller_intent",
      listingId: reservedListing.id
    });
    await insertProductEvents({
      actorProfileId: buyer.profile.id,
      count: 1,
      eventType: "product_listing_card_clicked",
      listingId: soldListing.id
    });

    // Explicitly ignored product event for seller dashboard totals.
    await insertProductEvents({
      actorProfileId: buyer.profile.id,
      count: 5,
      eventType: "product_listing_recommendation_impression",
      listingId: activeListing.id
    });

    // Events and favorites on another seller's listing must not affect this seller dashboard.
    await insertProductEvents({
      actorProfileId: buyer.profile.id,
      count: 10,
      eventType: "product_listing_detail_viewed",
      listingId: otherSellerListing.id
    });
    await insertProductEvents({
      actorProfileId: buyer.profile.id,
      count: 10,
      eventType: "product_contact_seller_intent",
      listingId: otherSellerListing.id
    });

    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/seller/dashboard"
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as SellerDashboardResponse;
    const summary = body.data.summary;

    expect(summary.totals).toEqual({
      totalListings: 4,
      activeListings: 1,
      reservedListings: 1,
      soldListings: 1,
      archivedListings: 1,
      totalFavorites: 3,
      listingDetailViews: 3,
      listingClicks: 3,
      contactSellerIntents: 3
    });
    expect(summary.listings).toHaveLength(4);

    expect(getDashboardListing(summary, activeListing.id)).toMatchObject({
      listingId: activeListing.id,
      title: "Satıcı dashboard aktif bebek arabası",
      status: "active",
      favoriteCount: 2,
      detailViews: 2,
      listingClicks: 2,
      contactSellerIntents: 1
    });
    expect(getDashboardListing(summary, reservedListing.id)).toMatchObject({
      listingId: reservedListing.id,
      title: "Satıcı dashboard rezerve oto koltuğu",
      status: "reserved",
      favoriteCount: 1,
      detailViews: 1,
      listingClicks: 0,
      contactSellerIntents: 2
    });
    expect(getDashboardListing(summary, soldListing.id)).toMatchObject({
      listingId: soldListing.id,
      title: "Satıcı dashboard satıldı mama sandalyesi",
      status: "sold",
      favoriteCount: 0,
      detailViews: 0,
      listingClicks: 1,
      contactSellerIntents: 0
    });
    expect(getDashboardListing(summary, archivedListing.id)).toMatchObject({
      listingId: archivedListing.id,
      title: "Satıcı dashboard arşiv oyun halısı",
      status: "archived",
      favoriteCount: 0,
      detailViews: 0,
      listingClicks: 0,
      contactSellerIntents: 0
    });

    expect(response.body).not.toContain("Other seller listing must not leak into dashboard");
    expect(response.body).not.toContain(otherSeller.profile.id);
    expect(response.body).not.toContain(otherSeller.user.email);
    expectNoSensitiveDashboardLeak(response.body, {
      accessToken: seller.accessToken,
      buyerEmail: buyer.user.email,
      buyerDisplayName: buyer.profile.displayName,
      buyerProfileId: buyer.profile.id
    });
    expectNoSensitiveDashboardLeak(response.body, {
      accessToken: otherBuyer.accessToken,
      buyerEmail: otherBuyer.user.email,
      buyerDisplayName: otherBuyer.profile.displayName,
      buyerProfileId: otherBuyer.profile.id
    });
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

  async function setListingStatus(listingId: string, status: ListingLifecycleStatus): Promise<void> {
    await app.db
      .update(listings)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(listings.id, listingId));
  }

  async function addFavorite(accessToken: string, listingId: string): Promise<void> {
    const response = await app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId
      }
    });

    expect(response.statusCode).toBe(201);
  }

  async function insertProductEvents(input: {
    actorProfileId: string;
    count: number;
    eventType:
      | "product_listing_detail_viewed"
      | "product_listing_card_clicked"
      | "product_contact_seller_intent"
      | "product_recently_viewed_listing_clicked"
      | "product_listing_recommendation_impression";
    listingId: string;
  }): Promise<void> {
    await app.db.insert(events).values(
      Array.from({ length: input.count }, (_, index) => ({
        actorProfileId: input.actorProfileId,
        entityId: input.listingId,
        entityType: "listing",
        eventType: input.eventType,
        metadata: {
          index,
          rawBuyerEmail: BUYER_EMAIL_SENTINEL,
          rawMessageBody: RAW_MESSAGE_SENTINEL,
          rawPhone: RAW_PHONE_SENTINEL,
          source: "seller_dashboard_security_test"
        }
      }))
    );
  }
});

function getDashboardListing(summary: SellerDashboardSummary, listingId: string) {
  const listing = summary.listings.find((item) => item.listingId === listingId);

  if (!listing) {
    throw new Error(`Dashboard listing was not returned: ${listingId}`);
  }

  return listing;
}

function expectNoSensitiveDashboardLeak(
  responseBody: string,
  input: {
    accessToken: string;
    buyerDisplayName: string;
    buyerEmail: string;
    buyerProfileId: string;
  }
): void {
  expect(responseBody).not.toContain(input.accessToken);
  expect(responseBody).not.toContain(input.buyerEmail);
  expect(responseBody).not.toContain(input.buyerDisplayName);
  expect(responseBody).not.toContain(input.buyerProfileId);
  expect(responseBody).not.toContain(BUYER_EMAIL_SENTINEL);
  expect(responseBody).not.toContain(OTHER_BUYER_EMAIL_SENTINEL);
  expect(responseBody).not.toContain(BUYER_DISPLAY_NAME_SENTINEL);
  expect(responseBody).not.toContain(RAW_MESSAGE_SENTINEL);
  expect(responseBody).not.toContain(RAW_PHONE_SENTINEL);
  expect(responseBody).not.toContain("passwordHash");
  expect(responseBody).not.toContain("accessToken");
  expect(responseBody).not.toContain("refreshToken");
  expect(responseBody).not.toContain("buyerEmail");
  expect(responseBody).not.toContain("buyerProfileId");
  expect(responseBody).not.toContain("rawMessageBody");
  expect(responseBody).not.toContain("rawPhone");
}

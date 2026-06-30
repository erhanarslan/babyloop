import { events } from "@babyloop/database/schema";
import { desc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createCategory, createListing, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

type ProductEventApiResponse = {
  ok: true;
  data: {
    event: {
      id: string;
    };
  };
};

type SellerDashboardResponse = {
  ok: true;
  data: {
    summary: {
      totals: {
        contactSellerIntents: number;
        listingClicks: number;
        listingDetailViews: number;
      };
      listings: Array<{
        listingId: string;
        contactSellerIntents: number;
        detailViews: number;
        listingClicks: number;
      }>;
    };
  };
};

const RAW_EMAIL_SENTINEL = "raw-product-event-buyer@example.test";
const RAW_PHONE_SENTINEL = "+905551112233";
const RAW_MESSAGE_SENTINEL = "RAW_PRODUCT_EVENT_MESSAGE_BODY_SHOULD_NOT_BE_ACCEPTED";
const RAW_ACCESS_TOKEN_SENTINEL = "RAW_PRODUCT_EVENT_ACCESS_TOKEN_SHOULD_NOT_BE_ACCEPTED";
const RAW_SEARCH_QUERY_SENTINEL = "bebek arabası raw private query";
const LISTING_SOURCE = "listing_detail";
const CATEGORY_SOURCE = "category_grid";
const SEARCH_SOURCE = "search_results";

describe("product event routes", () => {
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

  it("records a guest listing detail event with privacy-safe metadata only", async () => {
    const seller = await createUser(app, {
      email: "product-event-guest-seller@example.test"
    });
    const listing = await createListing(app, seller.accessToken, {
      title: "Product event guest stroller"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/product-events",
      payload: {
        eventType: "listing_detail_viewed",
        listingId: listing.id,
        source: LISTING_SOURCE
      }
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as ProductEventApiResponse;
    expect(body).toMatchObject({
      ok: true,
      data: {
        event: {
          id: expect.any(String)
        }
      }
    });

    const event = await getEvent(body.data.event.id);

    expect(event).toMatchObject({
      actorProfileId: null,
      entityId: listing.id,
      entityType: "listing",
      eventType: "product_listing_detail_viewed"
    });
    expect(event.metadata).toEqual({
      listingId: listing.id,
      source: LISTING_SOURCE
    });
    expectNoSensitiveEventLeak(JSON.stringify(event));
  });

  it("records authenticated listing events with actor profile and seller dashboard aggregation", async () => {
    const seller = await createUser(app, {
      email: "product-event-seller@example.test"
    });
    const buyer = await createUser(app, {
      displayName: "Product Event Buyer",
      email: RAW_EMAIL_SENTINEL
    });
    const listing = await createListing(app, seller.accessToken, {
      title: "Product event seller metrics stroller"
    });

    await postProductEvent({
      accessToken: buyer.accessToken,
      expectedEventType: "product_listing_detail_viewed",
      payload: {
        eventType: "listing_detail_viewed",
        listingId: listing.id,
        source: "listing_detail"
      }
    });
    await postProductEvent({
      accessToken: buyer.accessToken,
      expectedEventType: "product_listing_card_clicked",
      payload: {
        eventType: "listing_card_clicked",
        listingId: listing.id,
        source: "search_results"
      }
    });
    await postProductEvent({
      accessToken: buyer.accessToken,
      expectedEventType: "product_recently_viewed_listing_clicked",
      payload: {
        eventType: "recently_viewed_listing_clicked",
        listingId: listing.id,
        source: "recently_viewed"
      }
    });
    const contactIntentEvent = await postProductEvent({
      accessToken: buyer.accessToken,
      expectedEventType: "product_contact_seller_intent",
      payload: {
        eventType: "contact_seller_intent",
        listingId: listing.id,
        source: "listing_detail"
      }
    });

    expect(contactIntentEvent.actorProfileId).toBe(buyer.profile.id);

    const sellerDashboard = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/seller/dashboard"
    });

    expect(sellerDashboard.statusCode).toBe(200);

    const dashboardBody = sellerDashboard.json() as SellerDashboardResponse;

    expect(dashboardBody.data.summary.totals).toMatchObject({
      contactSellerIntents: 1,
      listingClicks: 2,
      listingDetailViews: 1
    });
    expect(dashboardBody.data.summary.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          listingId: listing.id,
          contactSellerIntents: 1,
          detailViews: 1,
          listingClicks: 2
        })
      ])
    );
    expectNoSensitiveEventLeak(sellerDashboard.body);
  });

  it("records category and search events with stable entity mapping and result buckets", async () => {
    const categoryId = await getFirstCategoryId();

    const categoryResponse = await app.inject({
      method: "POST",
      url: "/api/v1/product-events",
      payload: {
        categoryId,
        eventType: "category_viewed",
        source: CATEGORY_SOURCE
      }
    });

    expect(categoryResponse.statusCode).toBe(200);

    const categoryBody = categoryResponse.json() as ProductEventApiResponse;
    const categoryEvent = await getEvent(categoryBody.data.event.id);

    expect(categoryEvent).toMatchObject({
      actorProfileId: null,
      entityId: categoryId,
      entityType: "category",
      eventType: "product_category_viewed"
    });
    expect(categoryEvent.metadata).toEqual({
      categoryId,
      source: CATEGORY_SOURCE
    });

    const searchBuckets: Array<{
      resultBucket: string;
      resultCount: number;
    }> = [
      { resultBucket: "0", resultCount: 0 },
      { resultBucket: "1-5", resultCount: 5 },
      { resultBucket: "6-20", resultCount: 20 },
      { resultBucket: "21-100", resultCount: 100 },
      { resultBucket: "100+", resultCount: 101 }
    ];

    for (const bucket of searchBuckets) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/product-events",
        payload: {
          eventType: "search_performed",
          queryLength: 14,
          resultCount: bucket.resultCount,
          source: SEARCH_SOURCE
        }
      });

      expect(response.statusCode).toBe(200);

      const body = response.json() as ProductEventApiResponse;
      const searchEvent = await getEvent(body.data.event.id);

      expect(searchEvent).toMatchObject({
        actorProfileId: null,
        entityId: "00000000-0000-0000-0000-000000000000",
        entityType: "search",
        eventType: "product_search_performed"
      });
      expect(searchEvent.metadata).toEqual({
        queryLength: 14,
        resultBucket: bucket.resultBucket,
        resultCount: bucket.resultCount,
        source: SEARCH_SOURCE
      });
    }
  });

  it("rejects invalid or privacy-unsafe product event payloads without inserting events", async () => {
    const seller = await createUser(app, {
      email: "product-event-invalid-seller@example.test"
    });
    const listing = await createListing(app, seller.accessToken, {
      title: "Product event invalid payload stroller"
    });
    const categoryId = await getFirstCategoryId();

    const invalidPayloads: unknown[] = [
      {},
      {
        eventType: "listing_detail_viewed",
        listingId: "not-a-uuid",
        source: LISTING_SOURCE
      },
      {
        eventType: "listing_detail_viewed",
        listingId: listing.id,
        rawEmail: RAW_EMAIL_SENTINEL,
        source: LISTING_SOURCE
      },
      {
        eventType: "listing_card_clicked",
        listingId: listing.id,
        metadata: {
          email: RAW_EMAIL_SENTINEL,
          messageBody: RAW_MESSAGE_SENTINEL
        },
        source: "search_results"
      },
      {
        eventType: "contact_seller_intent",
        listingId: listing.id,
        phone: RAW_PHONE_SENTINEL,
        source: "listing_detail"
      },
      {
        eventType: "search_performed",
        query: RAW_SEARCH_QUERY_SENTINEL,
        queryLength: 14,
        resultCount: 2,
        source: SEARCH_SOURCE
      },
      {
        eventType: "search_performed",
        queryLength: 0,
        resultCount: 2,
        source: SEARCH_SOURCE
      },
      {
        eventType: "search_performed",
        queryLength: 14,
        resultCount: -1,
        source: SEARCH_SOURCE
      },
      {
        eventType: "category_viewed",
        categoryId,
        accessToken: RAW_ACCESS_TOKEN_SENTINEL,
        source: CATEGORY_SOURCE
      },
      {
        eventType: "raw_message_viewed",
        listingId: listing.id,
        source: LISTING_SOURCE
      }
    ];

    for (const payload of invalidPayloads) {
      const beforeCount = await countEvents();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/product-events",
        payload
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Product event body is invalid."
        }
      });
      expect(response.body).not.toContain(RAW_EMAIL_SENTINEL);
      expect(response.body).not.toContain(RAW_PHONE_SENTINEL);
      expect(response.body).not.toContain(RAW_MESSAGE_SENTINEL);
      expect(response.body).not.toContain(RAW_ACCESS_TOKEN_SENTINEL);
      expect(response.body).not.toContain(RAW_SEARCH_QUERY_SENTINEL);
      expect(await countEvents()).toBe(beforeCount);
    }
  });

  async function postProductEvent(input: {
    accessToken: string;
    expectedEventType: string;
    payload: unknown;
  }) {
    const response = await app.inject({
      headers: authHeader(input.accessToken),
      method: "POST",
      url: "/api/v1/product-events",
      payload: input.payload
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as ProductEventApiResponse;
    const event = await getEvent(body.data.event.id);

    expect(event.eventType).toBe(input.expectedEventType);
    expectNoSensitiveEventLeak(JSON.stringify(event));

    return event;
  }

  async function getFirstCategoryId(): Promise<string> {
    return (await createCategory(app.db, {
      name: "Product event category",
      slug: "product-event-category"
    })).id;
  }

  async function getEvent(eventId: string) {
    const [event] = await app.db
      .select({
        actorProfileId: events.actorProfileId,
        entityId: events.entityId,
        entityType: events.entityType,
        eventType: events.eventType,
        metadata: events.metadata
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      throw new Error(`Product event was not persisted: ${eventId}`);
    }

    return event;
  }

  async function countEvents(): Promise<number> {
    const rows = await app.db
      .select({
        id: events.id
      })
      .from(events)
      .orderBy(desc(events.createdAt));

    return rows.length;
  }
});

function expectNoSensitiveEventLeak(serialized: string): void {
  expect(serialized).not.toContain(RAW_EMAIL_SENTINEL);
  expect(serialized).not.toContain(RAW_PHONE_SENTINEL);
  expect(serialized).not.toContain(RAW_MESSAGE_SENTINEL);
  expect(serialized).not.toContain(RAW_ACCESS_TOKEN_SENTINEL);
  expect(serialized).not.toContain(RAW_SEARCH_QUERY_SENTINEL);
  expect(serialized).not.toContain("rawEmail");
  expect(serialized).not.toContain("phone");
  expect(serialized).not.toContain("messageBody");
  expect(serialized).not.toContain("accessToken");
  expect(serialized).not.toContain("refreshToken");
  expect(serialized).not.toContain("passwordHash");
  expect(serialized).not.toContain("query:");
}

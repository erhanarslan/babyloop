import { describe, expect, it } from "vitest";
import {
  productEventBodySchema,
  productEventTypeSchema
} from "../src/schemas/product-events.schemas.js";

const LISTING_ID = "00000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "00000000-0000-4000-8000-000000000002";

describe("product event schemas", () => {
  it("accepts a privacy-safe listing detail view event", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "listing_detail_viewed",
      listingId: LISTING_ID,
      source: "listing_detail"
    });

    expect(result.success).toBe(true);
  });

  it("accepts a category view event without listing id", () => {
    const result = productEventBodySchema.safeParse({
      categoryId: CATEGORY_ID,
      eventType: "category_viewed",
      source: "category_grid"
    });

    expect(result.success).toBe(true);
  });

  it("accepts a search event with only aggregate query metadata", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "search_performed",
      queryLength: 14,
      resultCount: 12,
      source: "search_results"
    });

    expect(result.success).toBe(true);
  });

  it("accepts a recently viewed listing click event", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "recently_viewed_listing_clicked",
      listingId: LISTING_ID,
      source: "recently_viewed"
    });

    expect(result.success).toBe(true);
  });

  it("accepts a recommendation impression event", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "listing_recommendation_impression",
      listingId: LISTING_ID,
      source: "listing_recommendations"
    });

    expect(result.success).toBe(true);
  });

  it("keeps exported product event type schema aligned with recommendation impressions", () => {
    expect(productEventTypeSchema.safeParse("listing_recommendation_impression").success).toBe(true);
    expect(productEventTypeSchema.safeParse("recently_viewed_listing_clicked").success).toBe(true);
    expect(productEventTypeSchema.safeParse("category_viewed").success).toBe(true);
    expect(productEventTypeSchema.safeParse("search_performed").success).toBe(true);
    expect(productEventTypeSchema.safeParse("saved_search_created").success).toBe(true);
    expect(productEventTypeSchema.safeParse("favorite_added").success).toBe(true);
    expect(productEventTypeSchema.safeParse("listing_status_changed").success).toBe(true);
    expect(productEventTypeSchema.safeParse("browse_filter_applied").success).toBe(true);
    expect(productEventTypeSchema.safeParse("message_sent").success).toBe(true);
  });

  it("accepts marketplace lifecycle events with no-PII allowlisted metadata", () => {
    expect(
      productEventBodySchema.safeParse({
        categoryId: CATEGORY_ID,
        eventType: "saved_search_created",
        savedSearchId: "00000000-0000-4000-8000-000000000003",
        sort: "newest",
        source: "account_saved_searches"
      }).success
    ).toBe(true);

    expect(
      productEventBodySchema.safeParse({
        categoryId: CATEGORY_ID,
        eventType: "favorite_removed",
        listingId: LISTING_ID,
        source: "favorites"
      }).success
    ).toBe(true);

    expect(
      productEventBodySchema.safeParse({
        eventType: "listing_status_changed",
        listingId: LISTING_ID,
        source: "seller_dashboard",
        status: "reserved"
      }).success
    ).toBe(true);

    expect(
      productEventBodySchema.safeParse({
        city: "İstanbul",
        condition: "good",
        eventType: "browse_filter_applied",
        limit: 16,
        listingType: "sale",
        offset: 0,
        sort: "price_desc",
        source: "browse_filters"
      }).success
    ).toBe(true);

    expect(
      productEventBodySchema.safeParse({
        conversationId: "00000000-0000-4000-8000-000000000004",
        eventType: "message_sent",
        source: "conversation"
      }).success
    ).toBe(true);
  });

  it("rejects raw search query and unknown metadata fields", () => {
    expect(
      productEventBodySchema.safeParse({
        eventType: "search_performed",
        query: "bebek arabası",
        queryLength: 14,
        resultCount: 2,
        source: "search_results"
      }).success
    ).toBe(false);

    expect(
      productEventBodySchema.safeParse({
        eventType: "listing_detail_viewed",
        listingId: LISTING_ID,
        metadata: {
          email: "buyer@example.test",
          phone: "+905551112233"
        },
        source: "listing_detail"
      }).success
    ).toBe(false);

    expect(
      productEventBodySchema.safeParse({
        eventType: "message_sent",
        conversationId: "00000000-0000-4000-8000-000000000004",
        rawMessageBody: "private message",
        source: "conversation"
      }).success
    ).toBe(false);

    expect(
      productEventBodySchema.safeParse({
        eventType: "saved_search_created",
        query: "private query",
        savedSearchId: "00000000-0000-4000-8000-000000000003",
        source: "account_saved_searches"
      }).success
    ).toBe(false);
  });

  it("requires a valid listing id for listing events", () => {
    expect(
      productEventBodySchema.safeParse({
        eventType: "listing_detail_viewed",
        listingId: "not-a-uuid",
        source: "listing_detail"
      }).success
    ).toBe(false);

    expect(
      productEventBodySchema.safeParse({
        eventType: "listing_card_clicked",
        source: "listing_card"
      }).success
    ).toBe(false);
  });

  it("requires a valid category id for category events", () => {
    expect(
      productEventBodySchema.safeParse({
        categoryId: "not-a-uuid",
        eventType: "category_viewed",
        source: "category_grid"
      }).success
    ).toBe(false);

    expect(
      productEventBodySchema.safeParse({
        eventType: "category_viewed",
        source: "category_grid"
      }).success
    ).toBe(false);
  });

  it("requires aggregate-only valid search metadata for search events", () => {
    expect(
      productEventBodySchema.safeParse({
        eventType: "search_performed",
        queryLength: 0,
        resultCount: 2,
        source: "search_results"
      }).success
    ).toBe(false);

    expect(
      productEventBodySchema.safeParse({
        eventType: "search_performed",
        queryLength: 14,
        resultCount: -1,
        source: "search_results"
      }).success
    ).toBe(false);

    expect(
      productEventBodySchema.safeParse({
        eventType: "search_performed",
        queryLength: 201,
        resultCount: 2,
        source: "search_results"
      }).success
    ).toBe(false);
  });

  it("rejects unsupported product event types and unsafe source values", () => {
    expect(productEventTypeSchema.safeParse("raw_message_viewed").success).toBe(false);

    expect(
      productEventBodySchema.safeParse({
        eventType: "raw_message_viewed",
        listingId: LISTING_ID,
        source: "listing_detail"
      }).success
    ).toBe(false);

    expect(
      productEventBodySchema.safeParse({
        eventType: "listing_detail_viewed",
        listingId: LISTING_ID,
        source: "raw_private_source"
      }).success
    ).toBe(false);
  });
});

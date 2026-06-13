import { describe, expect, it } from "vitest";
import { productEventBodySchema } from "../src/schemas/product-events.schemas.js";

const LISTING_ID = "00000000-0000-0000-0000-000000000001";
const CATEGORY_ID = "00000000-0000-0000-0000-000000000002";

describe("product event schemas", () => {
  it("accepts a privacy-safe listing detail view event", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "listing_detail_viewed",
      listingId: LISTING_ID,
      categoryId: CATEGORY_ID,
      source: "listing_detail"
    });

    expect(result.success).toBe(true);
  });

  it("accepts a category view event without listing id", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "category_viewed",
      categoryId: CATEGORY_ID,
      source: "category_landing"
    });

    expect(result.success).toBe(true);
  });

  it("accepts a search event with only aggregate query metadata", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "search_performed",
      queryLength: 12,
      resultCount: 8,
      categoryId: CATEGORY_ID,
      source: "browse"
    });

    expect(result.success).toBe(true);
  });

  it("accepts a recently viewed listing click event", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "recently_viewed_listing_clicked",
      listingId: LISTING_ID,
      categoryId: CATEGORY_ID,
      source: "recently_viewed"
    });

    expect(result.success).toBe(true);
  });

  it("accepts a recommendation impression event", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "listing_recommendation_impression",
      listingId: LISTING_ID,
      categoryId: CATEGORY_ID,
      source: "recommendation"
    });

    expect(result.success).toBe(true);
  });

  it("rejects raw search query and unknown metadata fields", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "search_performed",
      queryLength: 12,
      rawQuery: "bebek arabası",
      userAgent: "Mozilla",
      referrer: "https://example.com/private"
    });

    expect(result.success).toBe(false);
  });

  it("requires a valid listing id for listing events", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "listing_detail_viewed",
      listingId: "not-a-uuid",
      source: "listing_detail"
    });

    expect(result.success).toBe(false);
  });

  it("requires a valid category id for category events", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "category_viewed",
      categoryId: "not-a-uuid",
      source: "category_landing"
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported product event types", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "raw_message_viewed",
      listingId: LISTING_ID
    });

    expect(result.success).toBe(false);
  });
});

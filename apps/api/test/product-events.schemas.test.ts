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

  it("rejects raw search query and unknown metadata fields", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "listing_detail_viewed",
      listingId: LISTING_ID,
      rawQuery: "bebek arabası",
      userAgent: "Mozilla",
      referrer: "https://example.com/private"
    });

    expect(result.success).toBe(false);
  });

  it("requires a valid listing id", () => {
    const result = productEventBodySchema.safeParse({
      eventType: "listing_detail_viewed",
      listingId: "not-a-uuid",
      source: "listing_detail"
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

import { describe, expect, it } from "vitest";
import {
  listingRecommendationsParamsSchema,
  listingRecommendationsQuerySchema
} from "../src/schemas/listing-recommendations.schemas.js";

describe("listing recommendation schemas", () => {
  it("accepts a valid listing id", () => {
    const result = listingRecommendationsParamsSchema.safeParse({
      listingId: "00000000-0000-0000-0000-000000000001"
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid listing id", () => {
    const result = listingRecommendationsParamsSchema.safeParse({
      listingId: "not-a-uuid"
    });

    expect(result.success).toBe(false);
  });

  it("defaults recommendation limit", () => {
    const result = listingRecommendationsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.limit).toBe(8);
  });

  it("coerces supported recommendation limit", () => {
    const result = listingRecommendationsQuerySchema.safeParse({
      limit: "12"
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.limit).toBe(12);
  });

  it("rejects excessive recommendation limit", () => {
    const result = listingRecommendationsQuerySchema.safeParse({
      limit: "50"
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported query fields", () => {
    const result = listingRecommendationsQuerySchema.safeParse({
      limit: "8",
      rawQuery: "private"
    });

    expect(result.success).toBe(false);
  });
});

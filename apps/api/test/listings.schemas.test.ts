import { describe, expect, it } from "vitest";
import {
  createListingBodySchema,
  listingsQuerySchema,
  updateListingBodySchema
} from "../src/schemas/listings.schemas.js";

describe("listings schemas", () => {
  it("defaults pagination and sort values", () => {
    const result = listingsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.limit).toBe(20);
    expect(result.data.offset).toBe(0);
    expect(result.data.sort).toBe("newest");
  });

  it("accepts supported listing filters", () => {
    const result = listingsQuerySchema.safeParse({
      q: "  stroller  ",
      categoryId: "00000000-0000-0000-0000-000000000001",
      condition: "good",
      listingType: "sale",
      sort: "price_asc",
      limit: "12",
      offset: "24"
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.q).toBe("stroller");
    expect(result.data.limit).toBe(12);
    expect(result.data.offset).toBe(24);
  });

  it("treats empty optional filters as absent", () => {
    const result = listingsQuerySchema.safeParse({
      q: "",
      categoryId: "",
      condition: "",
      listingType: "",
      sort: "newest"
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.q).toBeUndefined();
    expect(result.data.categoryId).toBeUndefined();
    expect(result.data.condition).toBeUndefined();
    expect(result.data.listingType).toBeUndefined();
  });

  it("rejects invalid pagination values", () => {
    const result = listingsQuerySchema.safeParse({
      limit: "1000",
      offset: "-1"
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported filter values", () => {
    const result = listingsQuerySchema.safeParse({
      condition: "broken",
      listingType: "rental",
      sort: "popular"
    });

    expect(result.success).toBe(false);
  });

  it("rejects client-provided imageUrls in create/update listing contracts", () => {
    const createResult = createListingBodySchema.safeParse({
      categoryId: "00000000-0000-4000-8000-000000000001",
      condition: "good",
      imageUrls: ["https://example.com/image.jpg"],
      listingType: "sale",
      title: "Clean stroller"
    });

    const updateResult = updateListingBodySchema.safeParse({
      imageUrls: ["https://example.com/image.jpg"],
      title: "Updated stroller"
    });

    expect(createResult.success).toBe(false);
    expect(updateResult.success).toBe(false);
  });

});

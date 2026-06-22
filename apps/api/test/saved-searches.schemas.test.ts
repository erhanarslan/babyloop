import { describe, expect, it } from "vitest";
import {
  createSavedSearchBodySchema,
  savedSearchParamsSchema,
  updateSavedSearchNotificationsBodySchema
} from "../src/schemas/saved-searches.schemas.js";
import { listingsQuerySchema } from "../src/schemas/listings.schemas.js";

describe("saved search schemas", () => {
  it("accepts privacy-safe saved search filters", () => {
    const result = createSavedSearchBodySchema.safeParse({
      name: "Strollers with images",
      q: "stroller",
      listingType: "sale",
      condition: "good",
      priceMin: "100",
      priceMax: "5000.50",
      hasImages: true,
      sort: "price_asc"
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown saved search fields", () => {
    const result = createSavedSearchBodySchema.safeParse({
      name: "Bad saved search",
      q: "stroller",
      userAgent: "Mozilla"
    });

    expect(result.success).toBe(false);
  });


  it("accepts saved search notification toggle body", () => {
    const result = updateSavedSearchNotificationsBodySchema.safeParse({
      notificationsEnabled: true
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown saved search notification toggle fields", () => {
    const result = updateSavedSearchNotificationsBodySchema.safeParse({
      notificationsEnabled: true,
      deliveryProvider: "email"
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid saved search ids", () => {
    const result = savedSearchParamsSchema.safeParse({
      savedSearchId: "not-a-uuid"
    });

    expect(result.success).toBe(false);
  });

  it("accepts advanced listing filters", () => {
    const result = listingsQuerySchema.safeParse({
      q: "stroller",
      priceMin: "100",
      priceMax: "5000",
      hasImages: "true",
      sort: "price_desc"
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.hasImages).toBe(true);
  });

  it("rejects invalid advanced listing filters", () => {
    const result = listingsQuerySchema.safeParse({
      priceMin: "free",
      hasImages: "yes"
    });

    expect(result.success).toBe(false);
  });
});

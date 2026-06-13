import { describe, expect, it } from "vitest";
import { aiPriceSuggestionBodySchema } from "../src/schemas/ai-price-suggestions.schemas.js";

describe("AI price suggestion schema", () => {
  it("accepts privacy-safe pricing signals", () => {
    const result = aiPriceSuggestionBodySchema.safeParse({
      title: "Temiz bebek arabası",
      categoryName: "Bebek arabası",
      condition: "good",
      listingType: "sale",
      currentPriceAmount: "4500.00",
      currency: "try"
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.currency).toBe("TRY");
  });

  it("rejects unknown raw tracking fields", () => {
    const result = aiPriceSuggestionBodySchema.safeParse({
      categoryName: "Bebek arabası",
      userAgent: "Mozilla",
      referrer: "https://example.com/private"
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid prices", () => {
    const result = aiPriceSuggestionBodySchema.safeParse({
      categoryName: "Bebek arabası",
      currentPriceAmount: "free"
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one pricing signal", () => {
    const result = aiPriceSuggestionBodySchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

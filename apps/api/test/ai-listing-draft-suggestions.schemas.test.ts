import { describe, expect, it } from "vitest";
import { aiListingDraftFieldsSchema } from "../src/schemas/ai-listing-draft-suggestions.schemas.js";

describe("aiListingDraftFieldsSchema", () => {
  it("accepts a minimal Turkish draft suggestion request", () => {
    const result = aiListingDraftFieldsSchema.safeParse({
      categoryId: "11111111-1111-4111-8111-111111111111",
      listingType: "sale",
      title: "Temiz bebek arabası",
      description: "Az kullanılmış, katlanabilir bebek arabası.",
      condition: "good",
      priceAmount: "2500",
      currency: "try",
      city: "İstanbul",
      locale: "tr"
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.currency).toBe("TRY");
    }
  });

  it("rejects unsupported values", () => {
    const result = aiListingDraftFieldsSchema.safeParse({
      listingType: "rental",
      condition: "perfect",
      priceAmount: "12.999",
      locale: "en"
    });

    expect(result.success).toBe(false);
  });

  it("normalizes empty optional fields", () => {
    const result = aiListingDraftFieldsSchema.safeParse({
      title: "",
      description: "   ",
      categoryId: "",
      currency: ""
    });

    expect(result.success).toBe(false);
  });
});

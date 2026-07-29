import { describe, expect, it } from "vitest";
import { createListingBodySchema, updateListingBodySchema } from "../src/schemas/listings.schemas.js";
import { mapListingSummary } from "../src/services/listing-response.mapper.js";
import { applyOpenApiRouteContract } from "../src/openapi/openapi-contracts.js";

const summaryInput = {
  id: "11111111-1111-4111-8111-111111111111",
  isDemo: true,
  title: "Demo ürün",
  priceAmount: "100.00",
  currency: "TRY",
  status: "active",
  publicationState: "published" as const,
  publishAfter: null,
  publishedAt: new Date("2026-07-29T10:00:00.000Z"),
  publicationReviewReason: null,
  listingType: "sale",
  condition: "good",
  recommendedAgeMinMonths: 0,
  recommendedAgeMaxMonths: 12,
  createdAt: new Date("2026-07-29T10:00:00.000Z"),
  category: { id: "22222222-2222-4222-8222-222222222222", name: "Oyuncaklar", slug: "toys" },
  firstImage: null
};

describe("production demo public contract", () => {
  it("returns isDemo without leaking internal seed metadata", () => {
    const mapped = mapListingSummary({
      ...summaryInput,
      demoSeedKey: "must-not-leak",
      demoSeedVersion: "must-not-leak"
    });
    expect(mapped.isDemo).toBe(true);
    expect(mapped).not.toHaveProperty("demoSeedKey");
    expect(mapped).not.toHaveProperty("demoSeedVersion");
  });

  it("rejects demo fields in normal create and update bodies", () => {
    const base = {
      categoryId: "22222222-2222-4222-8222-222222222222",
      title: "Normal kullanıcı ilanı",
      description: "Temiz kullanıldı.",
      priceAmount: "100.00",
      currency: "TRY",
      listingType: "sale",
      condition: "good"
    };
    expect(createListingBodySchema.safeParse({ ...base, isDemo: true }).success).toBe(false);
    expect(updateListingBodySchema.safeParse({ title: "Güncel başlık", demoSeedKey: "x" }).success).toBe(false);
  });

  it("documents isDemo without exposing internal seed keys", () => {
    const schema = applyOpenApiRouteContract({ method: "GET", url: "/listings/:id", schema: {} });
    const serialized = JSON.stringify(schema);
    expect(serialized).toContain("isDemo");
    expect(serialized).not.toContain("demoSeedKey");
    expect(serialized).not.toContain("demoSeedVersion");
  });
});

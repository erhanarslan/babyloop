import { describe, expect, it } from "vitest";
import { ragSearchBodySchema, ragSearchResponseDataSchema } from "../src/schemas/rag.schemas.js";

describe("rag schemas", () => {
  it("accepts a valid search request", () => {
    const result = ragSearchBodySchema.safeParse({
      query: "Bebek arabası alırken nelere bakmalıyım?",
      limit: 5
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data.query : "").toBe("Bebek arabası alırken nelere bakmalıyım?");
  });

  it("rejects empty and too long queries", () => {
    expect(ragSearchBodySchema.safeParse({ query: "   " }).success).toBe(false);
    expect(ragSearchBodySchema.safeParse({ query: "a".repeat(1001) }).success).toBe(false);
  });

  it("rejects invalid limits", () => {
    expect(ragSearchBodySchema.safeParse({ query: "test", limit: 0 }).success).toBe(false);
    expect(ragSearchBodySchema.safeParse({ query: "test", limit: 11 }).success).toBe(false);
  });

  it("accepts response data with optional sources", () => {
    const result = ragSearchResponseDataSchema.safeParse({
      query: "test",
      results: [
        {
          score: 0.88,
          text: "Kaynak metni",
          citation: {
            title: "Güvenli alışveriş rehberi",
            sourcePath: "docs/rag/02-safe-shopping-guide.md",
            section: "Teslimat öncesi kontrol",
            topic: "safe-shopping"
          }
        }
      ]
    });

    expect(result.success).toBe(true);
  });
});

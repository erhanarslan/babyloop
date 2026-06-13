import { describe, expect, it } from "vitest";
import { searchSuggestionsQuerySchema } from "../src/schemas/search-suggestions.schemas.js";

describe("search suggestion schemas", () => {
  it("defaults an empty query and limit", () => {
    const result = searchSuggestionsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.q).toBe("");
    expect(result.data.limit).toBe(8);
  });

  it("trims a safe query and coerces limit", () => {
    const result = searchSuggestionsQuerySchema.safeParse({
      q: "  stroller  ",
      limit: "5"
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.q).toBe("stroller");
    expect(result.data.limit).toBe(5);
  });

  it("rejects unsupported fields", () => {
    const result = searchSuggestionsQuerySchema.safeParse({
      q: "stroller",
      userAgent: "Mozilla"
    });

    expect(result.success).toBe(false);
  });

  it("rejects excessive limits", () => {
    const result = searchSuggestionsQuerySchema.safeParse({
      q: "stroller",
      limit: "100"
    });

    expect(result.success).toBe(false);
  });
});

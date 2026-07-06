import { describe, expect, it } from "vitest";
import { createSavedSearchDraft } from "./saved-searches-model";

describe("createSavedSearchDraft", () => {
  it("normalizes saved-search filters and rejects empty names", () => {
    expect(() => createSavedSearchDraft({ name: "   " })).toThrow("Saved search name is required");

    expect(
      createSavedSearchDraft({
        name: "  Ataşehir   bebek arabası ",
        q: " bebek   arabası ",
        city: " İstanbul ",
        sort: "price_asc",
        priceMin: "100",
        priceMax: "bad"
      })
    ).toEqual({
      name: "Ataşehir bebek arabası",
      filters: {
        q: "bebek arabası",
        city: "İstanbul",
        sort: "price_asc",
        priceMin: 100
      }
    });
  });
});

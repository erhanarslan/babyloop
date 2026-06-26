import { describe, expect, it } from "vitest";
import { buildChildNeedDraft } from "../src/services/assistant-child-personalization.service.js";

describe("assistant child personalization", () => {
  it("uses explicit winter wording over current calendar season", () => {
    const draft = buildChildNeedDraft({
      query: "9 aylık bebeğim için kışa hazırlıkta hangi ikinci el ürünlere bakmalıyım?",
      ageSignal: "9 ay"
    });

    expect(draft.ageBand).toBe("infant_6_12");
    expect(draft.ageBandLabel).toBe("6-12 ay");
    expect(draft.season).toBe("winter");
    expect(draft.seasonLabel).toBe("Kış");
    expect(draft.suggestedSearches.some((item) => item.filters.season === "winter")).toBe(true);
    expect(draft.suggestedSearches.map((item) => item.query).join(" ")).toContain("puset ayak tulumu");
    expect(draft.suggestedSearches.map((item) => item.query).join(" ")).not.toContain("gölgelikli bebek arabası");
  });

  it("uses explicit summer wording when present", () => {
    const draft = buildChildNeedDraft({
      query: "18 aylık çocuk için yazlık ürünleri takip etmek istiyorum",
      ageSignal: "18 ay"
    });

    expect(draft.ageBand).toBe("toddler_12_24");
    expect(draft.season).toBe("summer");
    expect(draft.suggestedSearches.some((item) => item.filters.season === "summer")).toBe(true);
  });
});

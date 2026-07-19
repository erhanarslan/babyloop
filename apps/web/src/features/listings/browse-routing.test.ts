import { describe, expect, it } from "vitest";

import {
  buildListingsPath,
  DEFAULT_LISTINGS_LIMIT,
  resolveBrowseFilters,
  resolveBrowseLocationCity
} from "./browse-routing";

describe("browse routing", () => {
  it("uses safe defaults for empty params", () => {
    expect(resolveBrowseFilters(undefined)).toMatchObject({
      q: "",
      city: "",
      hasImages: "true",
      sort: "newest",
      limit: DEFAULT_LISTINGS_LIMIT,
      offset: 0
    });
  });

  it("parses supported listing filters and clamps pagination", () => {
    const filters = resolveBrowseFilters({
      q: " bebek arabası ",
      city: " İstanbul ",
      categoryId: "strollers",
      condition: "good",
      listingType: "sale",
      priceMin: "1000",
      priceMax: "5000",
      hasImages: "true",
      sort: "price_asc",
      limit: "999",
      offset: "-20"
    });

    expect(filters).toMatchObject({
      q: "bebek arabası",
      city: "İstanbul",
      categoryId: "strollers",
      condition: "good",
      listingType: "sale",
      priceMin: "1000",
      priceMax: "5000",
      hasImages: "true",
      sort: "price_asc",
      limit: 50,
      offset: 0
    });
  });

  it("ignores unknown params when building public listing path", () => {
    const filters = resolveBrowseFilters({
      q: "oto koltuğu",
      sort: "newest",
      internalUserId: "user-secret"
    });

    const path = buildListingsPath(filters);

    expect(path).toContain("q=oto+koltu%C4%9Fu");
    expect(path).toContain("hasImages=true");
    expect(path).toContain("sort=newest");
    expect(path).not.toContain("internalUserId");
    expect(path).not.toContain("user-secret");
  });

  it("preserves the selected city from the public URL to the listings API path", () => {
    const filters = resolveBrowseFilters({
      city: " İstanbul ",
      q: "puset"
    });

    expect(buildListingsPath(filters)).toContain("city=%C4%B0stanbul");
  });

  it("uses the stored marketplace city when the URL has no explicit city filter", () => {
    expect(resolveBrowseLocationCity({ q: "puset" }, "istanbul")).toBe("İstanbul");
    expect(resolveBrowseLocationCity(undefined, "turkiye")).toBe("");
  });

  it("keeps an explicit URL city ahead of the stored preference", () => {
    expect(resolveBrowseLocationCity({ city: " Ankara " }, "istanbul")).toBe("Ankara");
    expect(resolveBrowseLocationCity({ city: "" }, "istanbul")).toBe("");
  });

  it("falls back for invalid numeric filters", () => {
    const filters = resolveBrowseFilters({
      limit: "not-a-number",
      offset: "also-nope"
    });

    expect(filters.limit).toBe(DEFAULT_LISTINGS_LIMIT);
    expect(filters.offset).toBe(0);
  });
});

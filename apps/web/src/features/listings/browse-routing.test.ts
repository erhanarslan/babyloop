import { describe, expect, it } from "vitest";

import {
  buildListingsPath,
  DEFAULT_LISTINGS_LIMIT,
  resolveBrowseFilters
} from "./browse-routing";

describe("browse routing", () => {
  it("uses safe defaults for empty params", () => {
    expect(resolveBrowseFilters(undefined)).toMatchObject({
      q: "",
      hasImages: "true",
      sort: "newest",
      limit: DEFAULT_LISTINGS_LIMIT,
      offset: 0
    });
  });

  it("parses supported listing filters and clamps pagination", () => {
    const filters = resolveBrowseFilters({
      q: " bebek arabası ",
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

  it("falls back for invalid numeric filters", () => {
    const filters = resolveBrowseFilters({
      limit: "not-a-number",
      offset: "also-nope"
    });

    expect(filters.limit).toBe(DEFAULT_LISTINGS_LIMIT);
    expect(filters.offset).toBe(0);
  });
});

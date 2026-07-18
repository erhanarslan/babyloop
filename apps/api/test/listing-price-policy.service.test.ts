import { describe, expect, it } from "vitest";

import { resolveListingTypeForPrice } from "../src/services/listing-price-policy.service.js";

describe("listing price policy", () => {
  it("forces price-free listings to donation", () => {
    expect(resolveListingTypeForPrice({ listingType: "sale", priceAmount: null })).toBe("donation");
    expect(resolveListingTypeForPrice({ listingType: "swap", priceAmount: undefined })).toBe("donation");
  });

  it("preserves the selected type when a price exists", () => {
    expect(resolveListingTypeForPrice({ listingType: "sale", priceAmount: "1500.00" })).toBe("sale");
  });
});

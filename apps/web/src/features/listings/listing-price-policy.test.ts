import { describe, expect, it } from "vitest";

import {
  needsDonationConfirmation,
  toDonationListingPayload
} from "./listing-price-policy";

const basePayload = {
  categoryId: "category-1",
  condition: "good" as const,
  currency: "TRY",
  listingType: "sale" as const,
  title: "Temiz bebek arabası"
};

describe("listing price policy", () => {
  it("requires explicit confirmation when price is empty", () => {
    expect(needsDonationConfirmation(basePayload)).toBe(true);
    expect(needsDonationConfirmation({ ...basePayload, priceAmount: "1500" })).toBe(false);
  });

  it("converts price-free payloads into donation listings", () => {
    expect(toDonationListingPayload(basePayload)).toEqual({
      ...basePayload,
      listingType: "donation"
    });
  });
});

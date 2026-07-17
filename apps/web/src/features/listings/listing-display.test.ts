import { describe, expect, it } from "vitest";
import { formatListingPrice } from "./listing-display";
import { dictionaries } from "../../lib/i18n/dictionaries";

const dictionary = dictionaries.tr;

describe("formatListingPrice", () => {
  it("formats Turkish lira prices without noisy decimal text", () => {
    expect(formatListingPrice({ amount: "6500.00", currency: "TRY" }, dictionary)).toBe("₺6.500");
  });

  it("keeps price-on-request copy for missing prices", () => {
    expect(formatListingPrice(null, dictionary)).toBe(dictionary.common.priceOnRequest);
  });
});

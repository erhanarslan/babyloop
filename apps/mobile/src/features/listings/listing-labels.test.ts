import {
  formatMobileListingCondition,
  formatMobileListingType
} from "./listing-labels";

describe("mobile listing labels", () => {
  it("formats listing type labels for listing detail visibility", () => {
    expect(formatMobileListingType("sale")).toBe("Satılık");
    expect(formatMobileListingType("donation")).toBe("Bağış");
    expect(formatMobileListingType("swap")).toBe("Takas");
    expect(formatMobileListingType(null)).toBe("İlan tipi belirtilmedi");
  });

  it("formats condition labels", () => {
    expect(formatMobileListingCondition("like_new")).toBe("Yeni gibi");
    expect(formatMobileListingCondition("good")).toBe("İyi");
    expect(formatMobileListingCondition("unknown")).toBeNull();
  });
});

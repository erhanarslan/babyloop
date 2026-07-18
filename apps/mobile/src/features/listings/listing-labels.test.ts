import {
  formatMobileListingCondition,
  formatMobileListingStatus,
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

  it("formats listing status labels", () => {
    expect(formatMobileListingStatus("draft")).toBe("Taslak / incelemede");
    expect(formatMobileListingStatus("active")).toBe("Aktif");
    expect(formatMobileListingStatus("reserved")).toBe("Rezerve");
    expect(formatMobileListingStatus("sold")).toBe("Satıldı");
    expect(formatMobileListingStatus("archived")).toBe("Arşivde");
    expect(formatMobileListingStatus("unknown")).toBe("Durum bilinmiyor");
  });
});

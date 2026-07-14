import { buildMobileListingShareMessage } from "./listing-share-model";

describe("listing share model", () => {
  it("shares only the listing URL", () => {
    expect(
      buildMobileListingShareMessage({
        title: "Temiz kanguru",
        priceText: "1.250 TL",
        url: "https://babyloop.com.tr/s/Ab3xY9kQ"
      })
    ).toBe("https://babyloop.com.tr/s/Ab3xY9kQ");
  });

  it("removes line breaks from malformed URLs defensively", () => {
    expect(
      buildMobileListingShareMessage({
        title: "Bebek arabası",
        priceText: "2.000 TL",
        url: "https://babyloop.com.tr/s/Ab3xY9kQ\n"
      })
    ).toBe("https://babyloop.com.tr/s/Ab3xY9kQ");
  });
});

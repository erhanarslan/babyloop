import {
  getMobileListingDetailActionState,
  getMobileListingGalleryImageUrls
} from "./listing-detail-model";

describe("mobile listing detail model", () => {
  it("allows buyer actions for active listings and blocks cart for donations", () => {
    expect(getMobileListingDetailActionState({
      isOwnListing: false,
      listingType: "sale",
      status: "active"
    })).toMatchObject({
      canAddToCart: true,
      canFavorite: true,
      canMessageSeller: true,
      notice: null,
      statusTone: "success"
    });

    expect(getMobileListingDetailActionState({
      isOwnListing: false,
      listingType: "donation",
      status: "active"
    }).canAddToCart).toBe(false);
  });

  it("keeps reserved listings messageable but blocks cart", () => {
    expect(getMobileListingDetailActionState({
      isOwnListing: false,
      listingType: "sale",
      status: "reserved"
    })).toEqual({
      canAddToCart: false,
      canFavorite: true,
      canMessageSeller: true,
      notice: "Bu ürün rezerve. Uygunluk durumunu satıcıya sorabilirsin.",
      statusTone: "warning"
    });
  });

  it("blocks buyer actions for own, sold, and archived listings", () => {
    expect(getMobileListingDetailActionState({
      isOwnListing: true,
      listingType: "sale",
      status: "active"
    }).canMessageSeller).toBe(false);

    expect(getMobileListingDetailActionState({
      isOwnListing: false,
      listingType: "sale",
      status: "sold"
    })).toMatchObject({
      canAddToCart: false,
      canFavorite: false,
      canMessageSeller: false
    });

    expect(getMobileListingDetailActionState({
      isOwnListing: false,
      listingType: "sale",
      status: "archived"
    }).notice).toBe("Bu ilan yayında değil.");
  });

  it("deduplicates gallery images without leaking private data", () => {
    const urls = getMobileListingGalleryImageUrls({
      imageUrl: "https://cdn.example.test/cover.png",
      imageUrls: [
        "https://cdn.example.test/cover.png",
        "https://cdn.example.test/detail.png",
        "   "
      ]
    });

    expect(urls).toEqual([
      "https://cdn.example.test/cover.png",
      "https://cdn.example.test/detail.png"
    ]);
    expect(JSON.stringify(urls)).not.toMatch(/email|phone|accessToken|refreshToken|passwordHash/iu);
  });
});

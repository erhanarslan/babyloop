import {
  buildMobileListingEditPayload,
  createMobileListingEditFormState,
  getMobileListingEditImageLimitMessage,
  moveMobileListingImageId
} from "./listing-edit-model";
import type { MobileEditableListingDetail } from "./listings-api";

describe("mobile listing edit model", () => {
  it("creates edit form state from an editable listing", () => {
    expect(createMobileListingEditFormState(editableListing())).toEqual({
      categoryId: "category-1",
      condition: "good",
      description: "Temiz kullanıldı.",
      listingType: "sale",
      priceAmount: "1250.00",
      recommendedAgeRange: "12:24",
      title: "Temiz bebek arabası"
    });
  });

  it("validates and normalizes listing update payload", () => {
    expect(
      buildMobileListingEditPayload({
        categoryId: "category-1",
        condition: "like_new",
        description: "  Yeni gibi  ",
        listingType: "sale",
        priceAmount: "1250,50",
        recommendedAgeRange: "6:12",
        title: "  Bebek arabası  "
      })
    ).toEqual({
      ok: true,
      payload: {
        categoryId: "category-1",
        condition: "like_new",
        currency: "TRY",
        description: "Yeni gibi",
        listingType: "sale",
        priceAmount: "1250.50",
        recommendedAgeMinMonths: 6,
        recommendedAgeMaxMonths: 12,
        title: "Bebek arabası"
      }
    });
  });

  it("rejects invalid listing edit payloads", () => {
    expect(buildMobileListingEditPayload({
      categoryId: "",
      condition: "good",
      description: "",
      listingType: "sale",
      priceAmount: "",
      recommendedAgeRange: "independent",
      title: "Bebek arabası"
    })).toEqual({
      ok: false,
      message: "Kategori seçmelisin."
    });

    expect(buildMobileListingEditPayload({
      categoryId: "category-1",
      condition: "good",
      description: "",
      listingType: "sale",
      priceAmount: "12a",
      recommendedAgeRange: "independent",
      title: "Bebek arabası"
    })).toEqual({
      ok: false,
      message: "Fiyatı 1000 veya 1000.50 formatında yaz."
    });
  });

  it("moves image ids safely", () => {
    expect(moveMobileListingImageId({
      direction: "up",
      imageId: "image-2",
      imageIds: ["image-1", "image-2", "image-3"]
    })).toEqual(["image-2", "image-1", "image-3"]);

    expect(moveMobileListingImageId({
      direction: "down",
      imageId: "image-2",
      imageIds: ["image-1", "image-2", "image-3"]
    })).toEqual(["image-1", "image-3", "image-2"]);

    expect(moveMobileListingImageId({
      direction: "up",
      imageId: "missing",
      imageIds: ["image-1"]
    })).toEqual(["image-1"]);
  });

  it("guards the mobile image limit", () => {
    expect(getMobileListingEditImageLimitMessage({ currentCount: 5 })).toBe(
      "En fazla 5 fotoğraf ekleyebilirsin."
    );

    expect(getMobileListingEditImageLimitMessage({ currentCount: 4 })).toBeNull();
  });
});

function editableListing(): MobileEditableListingDetail {
  return {
    categoryId: "category-1",
    condition: "good",
    conditionText: "İyi",
    createdAt: "2026-07-14T10:00:00.000Z",
    description: "Temiz kullanıldı.",
    editableImages: [],
    favoriteCount: 0,
    id: "listing-1",
    imageUrl: null,
    imageUrls: [],
    listingType: "sale",
    listingTypeText: "Satılık",
    locationText: "Konum belirtilmedi",
    priceAmount: "1250.00",
    priceText: "1.250 TL",
    sellerProfileId: "profile-1",
    sellerDisplayName: "Ayşe",
    status: "active",
    statusText: "Aktif",
    publicationState: "published",
    publishAfter: null,
    publishedAt: "2026-07-14T10:00:30.000Z",
    publicationReviewReason: null,
    recommendedAgeMinMonths: 12,
    recommendedAgeMaxMonths: 24,
    title: "Temiz bebek arabası",
    viewerState: {
      isFavorited: false,
      isOwner: true
    }
  };
}

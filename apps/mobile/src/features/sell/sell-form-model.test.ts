import {
  buildMobileCreateListingPayload,
  createDefaultMobileSellFormState,
  normalizePriceAmount
} from "./sell-form-model";

describe("mobile sell form model", () => {
  it("builds the API create-listing payload safely", () => {
    const result = buildMobileCreateListingPayload({
      ...createDefaultMobileSellFormState(),
      categoryId: "00000000-0000-4000-8000-000000000001",
      condition: "good",
      description: "Temiz kullanıldı.  Yağmurluk dahildir.",
      listingType: "sale",
      priceAmount: "6500,50",
      recommendedAgeRange: "6:12",
      title: "  Temiz   bebek arabası  "
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        categoryId: "00000000-0000-4000-8000-000000000001",
        condition: "good",
        currency: "TRY",
        description: "Temiz kullanıldı. Yağmurluk dahildir.",
        listingType: "sale",
        priceAmount: "6500.50",
        recommendedAgeMinMonths: 6,
        recommendedAgeMaxMonths: 12,
        title: "Temiz bebek arabası"
      }
    });
  });

  it("rejects missing category, short title, and invalid price", () => {
    expect(
      buildMobileCreateListingPayload({
        ...createDefaultMobileSellFormState(),
        title: "Temiz bebek arabası"
      })
    ).toMatchObject({
      ok: false,
      message: "Kategori seçmelisin."
    });

    expect(
      buildMobileCreateListingPayload({
        ...createDefaultMobileSellFormState(),
        categoryId: "00000000-0000-4000-8000-000000000001",
        title: "abc"
      })
    ).toMatchObject({
      ok: false,
      message: "Başlık en az 4 karakter olmalı."
    });

    expect(
      buildMobileCreateListingPayload({
        ...createDefaultMobileSellFormState(),
        categoryId: "00000000-0000-4000-8000-000000000001",
        priceAmount: "10.000,00",
        title: "Temiz bebek arabası"
      })
    ).toMatchObject({
      ok: false,
      message: "Fiyatı 1000 veya 1000.50 formatında yaz."
    });
  });

  it("normalizes decimal comma prices for API contract", () => {
    expect(normalizePriceAmount(" 1250,75 ")).toBe("1250.75");
  });

  it("sends an explicit paired null range for age-independent listings", () => {
    expect(buildMobileCreateListingPayload({
      ...createDefaultMobileSellFormState(),
      categoryId: "00000000-0000-4000-8000-000000000001",
      title: "Temiz bebek arabası"
    })).toEqual({
      ok: true,
      payload: expect.objectContaining({
        recommendedAgeMinMonths: null,
        recommendedAgeMaxMonths: null
      })
    });
  });

  it("rejects an invalid or one-sided age range value", () => {
    expect(buildMobileCreateListingPayload({
      ...createDefaultMobileSellFormState(),
      categoryId: "00000000-0000-4000-8000-000000000001",
      recommendedAgeRange: "custom:24:12",
      title: "Temiz bebek arabası"
    })).toEqual({
      ok: false,
      message: "Geçerli bir önerilen yaş aralığı seçmelisin."
    });
  });
});

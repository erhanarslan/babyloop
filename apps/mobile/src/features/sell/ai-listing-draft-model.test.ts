import {
  applyMobileAiListingDraftToEmptyFields,
  formatMobileAiListingDraftPriceRange,
  getMobileAiListingDraftCategoryLabel,
  shouldMarkMobileAiListingDraftStale,
  type MobileAiListingDraftSuggestion
} from "./ai-listing-draft-model";
import { createDefaultMobileSellFormState } from "./sell-form-model";

const suggestion: MobileAiListingDraftSuggestion = {
  title: "Temiz bebek arabası",
  description: "Katlanabilir, günlük kullanıma uygun bebek arabası.",
  categoryId: "category-1",
  condition: "like_new",
  priceSuggestion: {
    min: 1200,
    max: 1800,
    currency: "TRY",
    confidence: "medium",
    reason: "Benzer ilanlara göre öneri."
  },
  imageFeedback: [],
  missingDetails: ["Marka/model"],
  warnings: ["Güvenlik ve kaza geçmişi satıcı tarafından doğrulanmalı."],
  confidence: "medium"
};

describe("mobile AI listing draft model", () => {
  it("applies AI suggestions only to empty title, description, and category fields", () => {
    expect(applyMobileAiListingDraftToEmptyFields(createDefaultMobileSellFormState(), suggestion)).toEqual({
      categoryId: "category-1",
      condition: "good",
      description: "Katlanabilir, günlük kullanıma uygun bebek arabası.",
      listingType: "sale",
      priceAmount: "",
      recommendedAgeRange: "independent",
      title: "Temiz bebek arabası"
    });
  });

  it("preserves existing user fields, price, listing type, and condition", () => {
    const form = {
      ...createDefaultMobileSellFormState(),
      categoryId: "user-category",
      condition: "fair" as const,
      description: "Kullanıcının açıklaması",
      listingType: "donation" as const,
      priceAmount: "500",
      title: "Kullanıcı başlığı"
    };

    expect(applyMobileAiListingDraftToEmptyFields(form, suggestion)).toEqual(form);
  });

  it("formats price suggestions as information without auto-applying them", () => {
    expect(formatMobileAiListingDraftPriceRange(suggestion)).toBe("1.200 - 1.800 TL");
  });

  it("resolves category labels from the loaded category list", () => {
    expect(getMobileAiListingDraftCategoryLabel("category-1", [
      {
        id: "category-1",
        name: "Bebek Arabaları",
        parentId: null,
        slug: "bebek-arabalari"
      }
    ])).toBe("Bebek Arabaları");
    expect(getMobileAiListingDraftCategoryLabel("missing", [])).toBeNull();
  });

  it("marks successful draft results stale when images change", () => {
    expect(shouldMarkMobileAiListingDraftStale({
      previousImageCount: 1,
      nextImageCount: 2,
      status: "success"
    })).toBe(true);
    expect(shouldMarkMobileAiListingDraftStale({
      previousImageCount: 1,
      nextImageCount: 2,
      status: "error"
    })).toBe(false);
  });
});

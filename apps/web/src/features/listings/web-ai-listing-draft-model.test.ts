import { describe, expect, it } from "vitest";
import {
  buildWebAiListingDraftApplyPatch,
  normalizeWebAiListingDraftSuggestion,
  shouldMarkWebAiListingDraftStale,
  type WebAiListingDraftFormSnapshot
} from "./web-ai-listing-draft-model";

const emptyForm: WebAiListingDraftFormSnapshot = {
  categoryId: "",
  condition: "good",
  description: "",
  listingType: "sale",
  priceAmount: "",
  title: ""
};

describe("web AI listing draft model", () => {
  it("normalizes safe fields without provider metadata or raw image ids", () => {
    const suggestion = normalizeWebAiListingDraftSuggestion({
      title: "Temiz bebek arabası",
      description: "Katlanabilir ürün.",
      categoryId: "category-1",
      condition: "good",
      confidence: "high",
      providerName: "provider",
      promptVersion: "v2",
      modelName: "model",
      imageFeedback: [
        {
          imageIdOrUrl: "data:image/png;base64,raw",
          message: "Fotoğraf net.",
          status: "good"
        }
      ],
      missingDetails: ["Telefon test@example.test"],
      warnings: ["sk-secret görünmesin"],
      priceSuggestion: {
        min: 100,
        max: 250,
        confidence: "medium",
        reason: "Yaklaşık aralık"
      }
    });

    expect(suggestion).toMatchObject({
      title: "Temiz bebek arabası",
      condition: "good",
      confidence: "high",
      imageFeedback: [{ message: "Fotoğraf net.", status: "good" }],
      missingDetails: ["Telefon [redacted-email]"],
      warnings: ["[redacted-token] görünmesin"]
    });
    expect(JSON.stringify(suggestion)).not.toMatch(/providerName|promptVersion|modelName|base64|data:image/iu);
  });

  it("preserves existing user fields and fills only empty title, description, and category fields", () => {
    const suggestion = normalizeWebAiListingDraftSuggestion({
      title: "Önerilen başlık",
      description: "Önerilen açıklama",
      categoryId: "category-1",
      condition: "new",
      priceSuggestion: {
        min: 100,
        max: 200,
        reason: "Bilgi amaçlı"
      }
    })!;

    expect(buildWebAiListingDraftApplyPatch(emptyForm, suggestion)).toEqual({
      categoryId: "category-1",
      description: "Önerilen açıklama",
      title: "Önerilen başlık"
    });

    expect(buildWebAiListingDraftApplyPatch({
      ...emptyForm,
      categoryId: "category-user",
      condition: "fair",
      description: "Kullanıcı açıklaması",
      listingType: "donation",
      priceAmount: "500",
      title: "Kullanıcı başlığı"
    }, suggestion)).toEqual({});
  });

  it("does not apply stale drafts and detects meaningful form changes", () => {
    const suggestion = normalizeWebAiListingDraftSuggestion({
      title: "Önerilen başlık"
    })!;

    expect(buildWebAiListingDraftApplyPatch(emptyForm, suggestion, { stale: true })).toEqual({});
    expect(shouldMarkWebAiListingDraftStale(emptyForm, { ...emptyForm, title: "Yeni" })).toBe(true);
    expect(shouldMarkWebAiListingDraftStale(emptyForm, { ...emptyForm })).toBe(false);
  });

  it("rejects invalid structured responses", () => {
    expect(normalizeWebAiListingDraftSuggestion(null)).toBeNull();
  });
});

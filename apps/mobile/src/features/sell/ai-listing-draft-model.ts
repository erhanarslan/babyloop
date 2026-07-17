import type { MobileCategory } from "./sell-api";
import type {
  MobileListingCondition,
  MobileSellFormState
} from "./sell-form-model";

export type MobileAiListingDraftConfidence = "low" | "medium" | "high";

export type MobileAiListingDraftSuggestion = {
  title?: string;
  description?: string;
  categoryId?: string;
  condition?: MobileListingCondition;
  priceSuggestion?: {
    min: number;
    max: number;
    currency: "TRY";
    confidence: MobileAiListingDraftConfidence;
    reason: string;
  };
  imageFeedback: Array<{
    imageIdOrUrl: string;
    status: "good" | "unclear" | "possibly_irrelevant" | "needs_review";
    message: string;
  }>;
  missingDetails: string[];
  warnings: string[];
  confidence: MobileAiListingDraftConfidence;
};

export type MobileAiListingDraftStatus =
  | "idle"
  | "pending"
  | "success"
  | "error"
  | "unavailable"
  | "stale";

export function applyMobileAiListingDraftToEmptyFields(
  form: MobileSellFormState,
  suggestion: MobileAiListingDraftSuggestion
): MobileSellFormState {
  return {
    ...form,
    title: form.title.trim() ? form.title : suggestion.title ?? form.title,
    description: form.description.trim() ? form.description : suggestion.description ?? form.description,
    categoryId: form.categoryId.trim() ? form.categoryId : suggestion.categoryId ?? form.categoryId
  };
}

export function getMobileAiListingDraftCategoryLabel(
  categoryId: string | undefined,
  categories: MobileCategory[]
): string | null {
  if (!categoryId) {
    return null;
  }

  return categories.find((category) => category.id === categoryId)?.name ?? null;
}

export function formatMobileAiListingDraftPriceRange(
  suggestion: MobileAiListingDraftSuggestion
): string | null {
  const price = suggestion.priceSuggestion;

  if (!price) {
    return null;
  }

  return `${price.min.toLocaleString("tr-TR")} - ${price.max.toLocaleString("tr-TR")} TL`;
}

export function getMobileAiListingDraftConfidenceLabel(
  confidence: MobileAiListingDraftConfidence
): string {
  switch (confidence) {
    case "high":
      return "Yüksek güven";
    case "medium":
      return "Orta güven";
    case "low":
      return "Düşük güven";
    default:
      return "Düşük güven";
  }
}

export function shouldMarkMobileAiListingDraftStale(input: {
  previousImageCount: number;
  nextImageCount: number;
  status: MobileAiListingDraftStatus;
}): boolean {
  return input.status === "success" && input.previousImageCount !== input.nextImageCount;
}

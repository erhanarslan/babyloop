import type { ListingCondition, ListingType } from "./listing-form-options";

export type WebAiListingDraftConfidence = "low" | "medium" | "high";

export type WebAiListingDraftSuggestion = {
  categoryId?: string;
  condition?: ListingCondition;
  confidence: WebAiListingDraftConfidence;
  description?: string;
  imageFeedback: Array<{
    message: string;
    status: "good" | "unclear" | "possibly_irrelevant" | "needs_review";
  }>;
  missingDetails: string[];
  priceSuggestion?: {
    confidence: WebAiListingDraftConfidence;
    currency: "TRY";
    max: number;
    min: number;
    reason: string;
  };
  title?: string;
  warnings: string[];
};

export type WebAiListingDraftFormSnapshot = {
  categoryId: string;
  condition: ListingCondition;
  description: string;
  listingType: ListingType;
  priceAmount: string;
  title: string;
};

export type WebAiListingDraftApplyResult = {
  categoryId?: string;
  description?: string;
  title?: string;
};

export function normalizeWebAiListingDraftSuggestion(payload: unknown): WebAiListingDraftSuggestion | null {
  if (!isRecord(payload)) {
    return null;
  }

  const title = pickText(payload.title, 160);
  const description = pickText(payload.description, 2000);
  const categoryId = pickText(payload.categoryId, 80);
  const condition = normalizeCondition(payload.condition);
  const priceSuggestion = normalizePriceSuggestion(payload.priceSuggestion);

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(condition ? { condition } : {}),
    ...(priceSuggestion ? { priceSuggestion } : {}),
    confidence: normalizeConfidence(payload.confidence) ?? "low",
    imageFeedback: normalizeImageFeedback(payload.imageFeedback),
    missingDetails: normalizeStringList(payload.missingDetails, 8, 140),
    warnings: normalizeStringList(payload.warnings, 8, 180)
  };
}

export function buildWebAiListingDraftApplyPatch(
  form: WebAiListingDraftFormSnapshot,
  suggestion: WebAiListingDraftSuggestion,
  options: { stale?: boolean } = {}
): WebAiListingDraftApplyResult {
  if (options.stale) {
    return {};
  }

  return {
    ...(!form.title.trim() && suggestion.title ? { title: suggestion.title } : {}),
    ...(!form.description.trim() && suggestion.description ? { description: suggestion.description } : {}),
    ...(!form.categoryId.trim() && suggestion.categoryId ? { categoryId: suggestion.categoryId } : {})
  };
}

export function shouldMarkWebAiListingDraftStale(
  previous: WebAiListingDraftFormSnapshot,
  next: WebAiListingDraftFormSnapshot
): boolean {
  return previous.categoryId !== next.categoryId ||
    previous.condition !== next.condition ||
    previous.description !== next.description ||
    previous.listingType !== next.listingType ||
    previous.priceAmount !== next.priceAmount ||
    previous.title !== next.title;
}

function normalizePriceSuggestion(value: unknown): WebAiListingDraftSuggestion["priceSuggestion"] {
  if (!isRecord(value)) {
    return undefined;
  }

  const min = typeof value.min === "number" ? Math.round(value.min) : Number.NaN;
  const max = typeof value.max === "number" ? Math.round(value.max) : Number.NaN;
  const reason = pickText(value.reason, 300);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min || !reason) {
    return undefined;
  }

  return {
    confidence: normalizeConfidence(value.confidence) ?? "low",
    currency: "TRY",
    max,
    min,
    reason
  };
}

function normalizeImageFeedback(value: unknown): WebAiListingDraftSuggestion["imageFeedback"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => {
      const message = pickText(item.message, 240);

      if (!message) {
        return null;
      }

      return {
        message,
        status: normalizeImageFeedbackStatus(item.status)
      };
    })
    .filter((item): item is WebAiListingDraftSuggestion["imageFeedback"][number] => item !== null)
    .slice(0, 5);
}

function normalizeStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => pickText(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function pickText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const sanitized = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/giu, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9._-]+/gu, "[redacted-token]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
    .trim()
    .slice(0, maxLength);

  return sanitized || undefined;
}

function normalizeConfidence(value: unknown): WebAiListingDraftConfidence | undefined {
  return value === "low" || value === "medium" || value === "high" ? value : undefined;
}

function normalizeCondition(value: unknown): ListingCondition | undefined {
  return value === "new" ||
    value === "like_new" ||
    value === "good" ||
    value === "fair" ||
    value === "needs_repair"
    ? value
    : undefined;
}

function normalizeImageFeedbackStatus(
  value: unknown
): WebAiListingDraftSuggestion["imageFeedback"][number]["status"] {
  return value === "good" ||
    value === "unclear" ||
    value === "possibly_irrelevant" ||
    value === "needs_review"
    ? value
    : "needs_review";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

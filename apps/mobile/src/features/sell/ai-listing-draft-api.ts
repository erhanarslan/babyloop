import { mobileAuthFetch } from "../auth/auth-api";
import {
  MOBILE_LISTING_IMAGE_LIMIT,
  buildMobileListingImageUploadFile,
  type MobilePickedImageInput
} from "./image-upload-model";
import type { MobileSellFormState } from "./sell-form-model";
import type {
  MobileAiListingDraftConfidence,
  MobileAiListingDraftSuggestion
} from "./ai-listing-draft-model";

export type MobileAiListingDraftRequest = {
  city?: string | null;
  formState: MobileSellFormState;
  locale?: "tr";
  selectedImages: MobilePickedImageInput[];
};

export async function fetchMobileAiListingDraftSuggestion(
  input: MobileAiListingDraftRequest
): Promise<MobileAiListingDraftSuggestion> {
  const formData = buildMobileAiListingDraftFormData(input);
  const response = await mobileAuthFetch("/api/v1/listings/ai-draft-suggestions", {
    method: "POST",
    body: formData
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      safeApiErrorMessage(payload, "AI taslağı şu an hazırlanamadı. Bilgileri manuel girebilirsin.")
    );
  }

  const suggestion = normalizeMobileAiListingDraftSuggestion(unwrapSuggestionPayload(payload));

  if (!suggestion) {
    throw new Error("AI taslağı yanıtı okunamadı. Bilgileri manuel girebilirsin.");
  }

  return suggestion;
}

export function buildMobileAiListingDraftFormData(input: MobileAiListingDraftRequest): FormData {
  const formData = new FormData();
  const formState = input.formState;

  appendTextField(formData, "locale", input.locale ?? "tr");
  appendTextField(formData, "currency", "TRY");
  appendTextField(formData, "categoryId", formState.categoryId);
  appendTextField(formData, "listingType", formState.listingType);
  appendTextField(formData, "title", formState.title);
  appendTextField(formData, "description", formState.description);
  appendTextField(formData, "condition", formState.condition);
  appendTextField(formData, "priceAmount", formState.priceAmount);
  appendTextField(formData, "city", input.city ?? "");

  for (const image of input.selectedImages.slice(0, MOBILE_LISTING_IMAGE_LIMIT)) {
    const imageFile = buildMobileListingImageUploadFile(image);

    if (!imageFile.ok) {
      throw new Error(imageFile.message);
    }

    formData.append("images", {
      uri: imageFile.file.uri,
      name: imageFile.file.name,
      type: imageFile.file.type
    } as unknown as Blob);
  }

  return formData;
}

export function normalizeMobileAiListingDraftSuggestion(payload: unknown): MobileAiListingDraftSuggestion | null {
  if (!isRecord(payload)) {
    return null;
  }

  const confidence = normalizeConfidence(payload.confidence) ?? "low";
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
    imageFeedback: normalizeImageFeedback(payload.imageFeedback),
    missingDetails: normalizeStringList(payload.missingDetails, 8, 120),
    warnings: normalizeStringList(payload.warnings, 8, 180),
    confidence
  };
}

function appendTextField(formData: FormData, key: string, value: string): void {
  const normalized = value.trim();

  if (normalized) {
    formData.append(key, normalized);
  }
}

function unwrapSuggestionPayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  if (isRecord(payload.data) && "suggestion" in payload.data) {
    return payload.data.suggestion;
  }

  if (isRecord(payload.suggestion)) {
    return payload.suggestion;
  }

  return payload;
}

function normalizePriceSuggestion(value: unknown): MobileAiListingDraftSuggestion["priceSuggestion"] {
  if (!isRecord(value)) {
    return undefined;
  }

  const min = typeof value.min === "number" ? Math.round(value.min) : Number.NaN;
  const max = typeof value.max === "number" ? Math.round(value.max) : Number.NaN;
  const confidence = normalizeConfidence(value.confidence) ?? "low";
  const reason = pickText(value.reason, 300);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min || !reason) {
    return undefined;
  }

  return {
    min,
    max,
    currency: "TRY",
    confidence,
    reason
  };
}

function normalizeImageFeedback(value: unknown): MobileAiListingDraftSuggestion["imageFeedback"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => {
      const imageIdOrUrl = normalizeSafeImageFeedbackId(item.imageIdOrUrl);
      const message = pickText(item.message, 240);
      const status = normalizeImageFeedbackStatus(item.status);

      if (!imageIdOrUrl || !message) {
        return null;
      }

      return {
        imageIdOrUrl,
        message,
        status
      };
    })
    .filter((item): item is MobileAiListingDraftSuggestion["imageFeedback"][number] => item !== null)
    .slice(0, MOBILE_LISTING_IMAGE_LIMIT);
}

function normalizeSafeImageFeedbackId(value: unknown): string | undefined {
  const imageIdOrUrl = pickText(value, 120);

  if (!imageIdOrUrl || /^data:/iu.test(imageIdOrUrl)) {
    return undefined;
  }

  return imageIdOrUrl;
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

function normalizeConfidence(value: unknown): MobileAiListingDraftConfidence | undefined {
  return value === "low" || value === "medium" || value === "high" ? value : undefined;
}

function normalizeCondition(value: unknown): MobileAiListingDraftSuggestion["condition"] {
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
): MobileAiListingDraftSuggestion["imageFeedback"][number]["status"] {
  return value === "good" ||
    value === "unclear" ||
    value === "possibly_irrelevant" ||
    value === "needs_review"
    ? value
    : "needs_review";
}

function safeApiErrorMessage(payload: unknown, fallback: string): string {
  const message = extractApiError(payload) ?? fallback;

  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/giu, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9._-]+/gu, "[redacted-token]")
    .replace(/accessToken["':=\s]+[A-Za-z0-9._-]+/giu, "accessToken=[redacted]")
    .replace(/refreshToken["':=\s]+[A-Za-z0-9._-]+/giu, "refreshToken=[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]");
}

function extractApiError(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

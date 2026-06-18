import {
  dataUrlToGeminiInlineData,
  generateGeminiJson,
  type GeminiPart
} from "./gemini-api.js";
import { LISTING_DRAFT_SUGGESTION_GEMINI_PROMPT_VERSION } from "./prompt-versions.js";
import type {
  ListingDraftSuggestionCondition,
  ListingDraftSuggestionConfidence,
  ListingDraftSuggestionInput,
  ListingDraftSuggestionOutput,
  ListingDraftSuggestionProvider
} from "./types.js";

type FetchLike = Parameters<typeof generateGeminiJson>[0]["fetch"];

export type GeminiListingDraftSuggestionProviderOptions = {
  apiKey: string;
  endpoint?: string;
  fetch?: FetchLike;
  model: string;
};

const GEMINI_PROVIDER_NAME = "gemini-generate-content";

export class GeminiListingDraftSuggestionProvider implements ListingDraftSuggestionProvider {
  readonly providerName = GEMINI_PROVIDER_NAME;
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly endpoint: string | undefined;
  private readonly fetchFn: FetchLike | undefined;

  constructor(options: GeminiListingDraftSuggestionProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.modelName = options.model.trim();
    this.endpoint = options.endpoint?.trim() || undefined;
    this.fetchFn = options.fetch;

    if (!this.apiKey) {
      throw new Error("Gemini listing draft provider requires GEMINI_API_KEY.");
    }

    if (!this.modelName) {
      throw new Error("Gemini listing draft provider requires GEMINI_LISTING_DRAFT_MODEL.");
    }
  }

  async suggestListingDraft(input: ListingDraftSuggestionInput): Promise<ListingDraftSuggestionOutput> {
    const payload = await generateGeminiJson({
      apiKey: this.apiKey,
      ...(this.endpoint ? { endpoint: this.endpoint } : {}),
      ...(this.fetchFn ? { fetch: this.fetchFn } : {}),
      model: this.modelName,
      parts: buildParts(input),
      responseSchema: listingDraftResponseSchema,
      systemInstruction: buildSystemPrompt(),
      temperature: 0.2
    });
    const parsed = normalizeListingDraftOutput(payload, input);

    return {
      ...parsed,
      providerName: this.providerName,
      promptVersion: LISTING_DRAFT_SUGGESTION_GEMINI_PROMPT_VERSION,
      modelName: this.modelName
    };
  }
}

function buildParts(input: ListingDraftSuggestionInput): GeminiPart[] {
  const publicInput = {
    locale: input.locale ?? "tr",
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    listingType: input.listingType,
    title: input.title,
    description: input.description,
    condition: input.condition,
    priceAmount: input.priceAmount,
    currency: input.currency ?? "TRY",
    city: input.city,
    images: input.images.map((image) => ({
      id: image.id,
      filename: image.filename,
      contentType: image.contentType
    })),
    categoryCandidates: input.categoryCandidates
  };
  const parts: GeminiPart[] = [{ text: JSON.stringify(publicInput) }];

  for (const image of input.images) {
    if (!image.dataUrl) {
      continue;
    }

    const part = dataUrlToGeminiInlineData(image.dataUrl);

    if (part) {
      parts.push(part);
    }
  }

  return parts;
}

function buildSystemPrompt(): string {
  return [
    "Sen BabyLoop için Türkçe ilan taslağı asistanısın. Bebek/çocuk ikinci el marketplace ilanlarını iyileştirirsin.",
    "Yalnızca verilen taslak alanlarını, kategori adaylarını ve yüklenen görselleri kullan.",
    "Görsel belirsizse veya güven düşükse bunu açıkça belirt; başlık/kategori önerisini zorlamadan düşük güven ver.",
    "Güvenlik sertifikası, tıbbi garanti, özel çocuk bilgisi, satıcı kimliği, telefon, e-posta veya açık adres çıkarımı yapma.",
    "Öneriler pratik ve yayınlamadan önce satıcının kontrol edebileceği şekilde olsun.",
    "Sadece JSON döndür."
  ].join(" ");
}

function normalizeListingDraftOutput(
  payload: unknown,
  input: ListingDraftSuggestionInput
): Omit<ListingDraftSuggestionOutput, "providerName" | "promptVersion" | "modelName"> {
  if (typeof payload !== "object" || payload === null) {
    return fallbackOutput(input);
  }

  const record = payload as Record<string, unknown>;
  const title = stringOrUndefined(record.title, 160);
  const description = stringOrUndefined(record.description, 2000);
  const categoryId = stringOrUndefined(record.categoryId, 80);
  const condition = isCondition(record.condition) ? record.condition : undefined;
  const priceSuggestion = normalizePriceSuggestion(record.priceSuggestion);
  const imageFeedback = normalizeImageFeedback(record.imageFeedback, input);
  const missingDetails = stringArray(record.missingDetails, 8, 120);
  const warnings = stringArray(record.warnings, 8, 180);
  const confidence = isConfidence(record.confidence) ? record.confidence : "low";

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(categoryId && input.categoryCandidates.some((category) => category.id === categoryId)
      ? { categoryId }
      : {}),
    ...(condition ? { condition } : {}),
    ...(priceSuggestion ? { priceSuggestion } : {}),
    imageFeedback,
    missingDetails,
    warnings,
    confidence
  };
}

function fallbackOutput(
  input: ListingDraftSuggestionInput
): Omit<ListingDraftSuggestionOutput, "providerName" | "promptVersion" | "modelName"> {
  return {
    imageFeedback: input.images.map((image) => ({
      imageIdOrUrl: image.id,
      status: "needs_review",
      message: "Görseli yayınlamadan önce ürünün net göründüğünü kontrol et."
    })),
    missingDetails: [],
    warnings: ["AI önerisi düşük güvenle döndü; başlığı, kategoriyi ve açıklamayı sen kontrol et."],
    confidence: "low"
  };
}

function normalizePriceSuggestion(value: unknown): ListingDraftSuggestionOutput["priceSuggestion"] {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const price = value as Record<string, unknown>;
  const min = typeof price.min === "number" ? price.min : Number.NaN;
  const max = typeof price.max === "number" ? price.max : Number.NaN;
  const confidence = isConfidence(price.confidence) ? price.confidence : "low";
  const reason = stringOrUndefined(price.reason, 300);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min || !reason) {
    return undefined;
  }

  return {
    min: Math.round(min),
    max: Math.round(max),
    currency: "TRY",
    confidence,
    reason
  };
}

function normalizeImageFeedback(
  value: unknown,
  input: ListingDraftSuggestionInput
): ListingDraftSuggestionOutput["imageFeedback"] {
  if (!Array.isArray(value)) {
    return fallbackOutput(input).imageFeedback;
  }

  const feedback = value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      imageIdOrUrl: stringOrUndefined(item.imageIdOrUrl, 120) ?? "",
      status: isImageFeedbackStatus(item.status) ? item.status : "needs_review",
      message: stringOrUndefined(item.message, 240) ?? "Görseli yayınlamadan önce kontrol et."
    }))
    .filter((item) => item.imageIdOrUrl.length > 0)
    .slice(0, input.images.length || 5);

  return feedback.length > 0 ? feedback : fallbackOutput(input).imageFeedback;
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLength))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
}

function stringOrUndefined(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : undefined;
}

function isConfidence(value: unknown): value is ListingDraftSuggestionConfidence {
  return value === "low" || value === "medium" || value === "high";
}

function isCondition(value: unknown): value is ListingDraftSuggestionCondition {
  return value === "new" || value === "like_new" || value === "good" || value === "fair" || value === "needs_repair";
}

function isImageFeedbackStatus(value: unknown): value is ListingDraftSuggestionOutput["imageFeedback"][number]["status"] {
  return value === "good" || value === "unclear" || value === "possibly_irrelevant" || value === "needs_review";
}

const listingDraftResponseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    categoryId: { type: "string" },
    condition: { type: "string" },
    priceSuggestion: {
      type: "object",
      properties: {
        min: { type: "number" },
        max: { type: "number" },
        currency: { type: "string" },
        confidence: { type: "string" },
        reason: { type: "string" }
      }
    },
    imageFeedback: {
      type: "array",
      items: {
        type: "object",
        properties: {
          imageIdOrUrl: { type: "string" },
          status: { type: "string" },
          message: { type: "string" }
        },
        required: ["imageIdOrUrl", "status", "message"]
      }
    },
    missingDetails: {
      type: "array",
      items: { type: "string" }
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    },
    confidence: { type: "string" }
  },
  required: ["imageFeedback", "missingDetails", "warnings", "confidence"]
} as const;

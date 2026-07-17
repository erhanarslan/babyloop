import { LISTING_DRAFT_SUGGESTION_OPENAI_PROMPT_VERSION_V2 } from "./prompt-versions.js";
import type {
  ListingDraftSuggestionCondition,
  ListingDraftSuggestionConfidence,
  ListingDraftSuggestionImageInput,
  ListingDraftSuggestionInput,
  ListingDraftSuggestionOutput,
  ListingDraftSuggestionProvider
} from "./types.js";

type FetchLike = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export type OpenAiListingDraftSuggestionProviderOptions = {
  apiKey: string;
  model: string;
  endpoint?: string;
  fetch?: FetchLike;
};

const DEFAULT_OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const OPENAI_PROVIDER_NAME = "openai-responses";

export class OpenAiListingDraftSuggestionProvider implements ListingDraftSuggestionProvider {
  readonly providerName = OPENAI_PROVIDER_NAME;
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetchFn: FetchLike;

  constructor(options: OpenAiListingDraftSuggestionProviderOptions) {
    const apiKey = options.apiKey.trim();
    const model = options.model.trim();

    if (!apiKey) {
      throw new Error("OpenAI listing draft suggestion provider requires OPENAI_API_KEY.");
    }

    if (!model) {
      throw new Error("OpenAI listing draft suggestion provider requires OPENAI_LISTING_DRAFT_MODEL.");
    }

    this.apiKey = apiKey;
    this.modelName = model;
    this.endpoint = options.endpoint?.trim() || DEFAULT_OPENAI_RESPONSES_ENDPOINT;
    this.fetchFn = options.fetch ?? getDefaultFetch();
  }

  async suggestListingDraft(input: ListingDraftSuggestionInput): Promise<ListingDraftSuggestionOutput> {
    const response = await this.fetchFn(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.modelName,
        store: false,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: buildSystemPrompt()
              }
            ]
          },
          {
            role: "user",
            content: buildUserContent(input)
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "babyloop_listing_draft_suggestion",
            strict: true,
            schema: listingDraftSuggestionJsonSchema
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI listing draft suggestion request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const parsed = parseOpenAiStructuredOutput(payload, input.images);

    return {
      ...parsed,
      providerName: this.providerName,
      promptVersion: LISTING_DRAFT_SUGGESTION_OPENAI_PROMPT_VERSION_V2,
      modelName: this.modelName
    };
  }
}

function getDefaultFetch(): FetchLike {
  const fetchFn = (globalThis as unknown as { fetch?: FetchLike }).fetch;

  if (!fetchFn) {
    throw new Error("OpenAI listing draft suggestion provider requires global fetch support.");
  }

  return fetchFn;
}

function buildSystemPrompt(): string {
  return [
    "You are BabyLoop's Turkish marketplace listing draft assistant for baby and child products.",
    "Use only the seller draft fields, category candidates, and uploaded listing images supplied by the user.",
    "Be conservative. If images are unclear or confidence is low, say so and leave title/category optional.",
    "Do not invent brand, model, measurements, age range, included accessories, or parts when they are not clearly visible or provided.",
    "Do not infer accident history, repair history, prior usage history, certification status, or safety suitability from images.",
    "For car seats, cribs, bassinets, bouncers, carriers, and other safety-sensitive products, never claim safe, accident-free, certified, problem-free, or guaranteed suitable.",
    "Mention only visible condition signals and put uncertain facts in missingDetails.",
    "Do not infer seller identity, contact details, private child details, medical claims, safety certification, or guarantees.",
    "Do not include phone numbers, emails, addresses, tokens, or raw private data.",
    "Price suggestions are approximate guidance only, not verified market truth. For low confidence, ask more questions.",
    "Return only JSON matching the schema. Keep all user-facing text in Turkish."
  ].join(" ");
}

function buildUserContent(input: ListingDraftSuggestionInput): Array<Record<string, unknown>> {
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

  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: JSON.stringify(publicInput)
    }
  ];

  for (const image of input.images) {
    if (!image.dataUrl) {
      continue;
    }

    content.push({
      type: "input_image",
      image_url: image.dataUrl,
      detail: "low"
    });
  }

  return content;
}

function parseOpenAiStructuredOutput(
  payload: unknown,
  images: ListingDraftSuggestionImageInput[]
): Omit<ListingDraftSuggestionOutput, "providerName" | "promptVersion" | "modelName"> {
  const text = extractOutputText(payload);

  if (!text) {
    throw new Error("OpenAI listing draft suggestion response did not include text output.");
  }

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const title = stringOrUndefined(parsed.title);
  const description = stringOrUndefined(parsed.description);
  const categoryId = stringOrUndefined(parsed.categoryId);
  const condition = isCondition(parsed.condition) ? parsed.condition : undefined;
  const priceSuggestion = normalizePriceSuggestion(parsed.priceSuggestion);
  const imageFeedback = normalizeImageFeedback(parsed.imageFeedback, images);
  const missingDetails = stringArray(parsed.missingDetails).slice(0, 8);
  const warnings = stringArray(parsed.warnings).slice(0, 8);
  const confidence = isConfidence(parsed.confidence) ? parsed.confidence : "low";

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(condition ? { condition } : {}),
    ...(priceSuggestion ? { priceSuggestion } : {}),
    imageFeedback,
    missingDetails,
    warnings,
    confidence
  };
}

function extractOutputText(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const outputText = (payload as { output_text?: unknown }).output_text;

  if (typeof outputText === "string") {
    return outputText;
  }

  const output = (payload as { output?: unknown }).output;

  if (!Array.isArray(output)) {
    return undefined;
  }

  for (const item of output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (typeof contentItem !== "object" || contentItem === null) {
        continue;
      }

      const text = (contentItem as { text?: unknown }).text;

      if (typeof text === "string") {
        return text;
      }
    }
  }

  return undefined;
}

function normalizePriceSuggestion(value: unknown): ListingDraftSuggestionOutput["priceSuggestion"] {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const price = value as Record<string, unknown>;
  const min = typeof price.min === "number" ? price.min : Number.NaN;
  const max = typeof price.max === "number" ? price.max : Number.NaN;
  const confidence = isConfidence(price.confidence) ? price.confidence : "low";
  const reason = stringOrUndefined(price.reason);

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
  images: ListingDraftSuggestionImageInput[]
): ListingDraftSuggestionOutput["imageFeedback"] {
  const fallback = images.map((image) => ({
    imageIdOrUrl: image.id,
    status: "needs_review" as const,
    message: "Görseli yayınlamadan önce ürünün net göründüğünü kontrol et."
  }));

  if (!Array.isArray(value)) {
    return fallback;
  }

  const feedback = value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      imageIdOrUrl: stringOrUndefined(item.imageIdOrUrl) ?? "",
      status: isImageFeedbackStatus(item.status) ? item.status : "needs_review",
      message: stringOrUndefined(item.message) ?? "Görseli yayınlamadan önce kontrol et."
    }))
    .filter((item) => item.imageIdOrUrl.length > 0)
    .slice(0, images.length || 5);

  return feedback.length > 0 ? feedback : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
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

const listingDraftSuggestionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "description",
    "categoryId",
    "condition",
    "priceSuggestion",
    "imageFeedback",
    "missingDetails",
    "warnings",
    "confidence"
  ],
  properties: {
    title: { type: ["string", "null"], maxLength: 160 },
    description: { type: ["string", "null"], maxLength: 2000 },
    categoryId: { type: ["string", "null"] },
    condition: {
      type: ["string", "null"],
      enum: ["new", "like_new", "good", "fair", "needs_repair", null]
    },
    priceSuggestion: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["min", "max", "currency", "confidence", "reason"],
          properties: {
            min: { type: "number", minimum: 1 },
            max: { type: "number", minimum: 1 },
            currency: { type: "string", enum: ["TRY"] },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            reason: { type: "string", maxLength: 300 }
          }
        }
      ]
    },
    imageFeedback: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["imageIdOrUrl", "status", "message"],
        properties: {
          imageIdOrUrl: { type: "string", maxLength: 120 },
          status: {
            type: "string",
            enum: ["good", "unclear", "possibly_irrelevant", "needs_review"]
          },
          message: { type: "string", maxLength: 240 }
        }
      }
    },
    missingDetails: {
      type: "array",
      maxItems: 8,
      items: { type: "string", maxLength: 120 }
    },
    warnings: {
      type: "array",
      maxItems: 8,
      items: { type: "string", maxLength: 180 }
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] }
  }
} as const;

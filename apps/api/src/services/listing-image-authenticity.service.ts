
import type { FastifyInstance } from "fastify";
import type { SafeImage } from "./image-safety.service.js";

export type ListingImageAuthenticityDecision = "allow" | "needs_review" | "reject";

export type ListingImageAuthenticityResult =
  | {
      status: "completed";
      decision: ListingImageAuthenticityDecision;
      confidence: number;
      providerName: string;
      modelName: string | null;
      promptVersion: string;
      reasons: string[];
      flags: Record<string, unknown>;
    }
  | {
      status: "unavailable";
      providerName: string;
      reason: string;
    };

type AnalyzeListingImageAuthenticityInput = {
  categoryName: string | null;
  description: string | null;
  image: SafeImage;
  listingId: string;
  originalFilename: string;
  title: string;
};

const PROMPT_VERSION = "listing_image_authenticity.openai.v1";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export async function analyzeListingImageAuthenticity(
  app: FastifyInstance,
  input: AnalyzeListingImageAuthenticityInput
): Promise<ListingImageAuthenticityResult> {
  const provider = (process.env.LISTING_IMAGE_AUTHENTICITY_PROVIDER ?? "").trim().toLowerCase();

  if (provider === "mock") {
    if (process.env.NODE_ENV === "production") {
      return {
        status: "unavailable",
        providerName: "mock-listing-image-authenticity",
        reason: "Mock image authenticity provider cannot run in production."
      };
    }

    return {
      status: "completed",
      decision: "allow",
      confidence: 0.99,
      providerName: "mock-listing-image-authenticity",
      modelName: "mock",
      promptVersion: "listing_image_authenticity.mock.v1",
      reasons: ["Mock provider allowed the image for local/test execution."],
      flags: {
        mock: true
      }
    };
  }

  if (!provider && process.env.NODE_ENV === "test") {
    return {
      status: "completed",
      decision: "allow",
      confidence: 0.99,
      providerName: "mock-listing-image-authenticity",
      modelName: "mock",
      promptVersion: "listing_image_authenticity.mock.v1",
      reasons: ["Test environment allowed the image."],
      flags: {
        mock: true
      }
    };
  }

  if (provider !== "openai") {
    return {
      status: "unavailable",
      providerName: provider || "unconfigured-listing-image-authenticity",
      reason: "LISTING_IMAGE_AUTHENTICITY_PROVIDER must be set to openai for real upload enforcement."
    };
  }

  return analyzeWithOpenAi(app, input);
}

async function analyzeWithOpenAi(
  app: FastifyInstance,
  input: AnalyzeListingImageAuthenticityInput
): Promise<ListingImageAuthenticityResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const modelName = process.env.LISTING_IMAGE_AUTHENTICITY_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const endpoint = process.env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com";

  if (!apiKey) {
    return {
      status: "unavailable",
      providerName: "openai-listing-image-authenticity",
      reason: "OPENAI_API_KEY is required for listing image authenticity checks."
    };
  }

  const dataUrl = `data:${input.image.contentType};base64,${input.image.buffer.toString("base64")}`;

  const prompt = [
    "You are a marketplace trust and safety image reviewer for BabyLoop, a baby and child product marketplace.",
    "",
    "Decide whether the uploaded image can be used as a listing image.",
    "",
    "Policy:",
    "- Allow only real photos of the actual physical product being listed.",
    "- Reject AI-generated images, renders, illustrations, cartoons, memes, logos, screenshots, stock/catalog images, unrelated objects, or images that do not show the listed product.",
    "- Use needs_review when the image may be a real product photo but you are uncertain, it looks catalog-like, or it may show a different product than the listing.",
    "- Reject or needs_review if sensitive child content, unsafe content, medical/treatment claims, or privacy concerns appear.",
    "",
    `Listing title: ${input.title}`,
    `Listing category: ${input.categoryName ?? "unknown"}`,
    `Listing description: ${input.description ?? "not provided"}`,
    `Original filename: ${input.originalFilename}`,
    "",
    "Return strict JSON only with this shape:",
    "{",
    "  \"decision\": \"allow\" | \"needs_review\" | \"reject\",",
    "  \"confidence\": number,",
    "  \"isRealProductPhoto\": boolean,",
    "  \"isGeneratedOrIllustration\": boolean,",
    "  \"isStockOrCatalogLike\": boolean,",
    "  \"isRelevantToListing\": boolean,",
    "  \"detectedObjects\": string[],",
    "  \"categoryHints\": string[],",
    "  \"safetyFlags\": {",
    "    \"containsChildFace\": boolean,",
    "    \"containsSensitiveChildContent\": boolean,",
    "    \"containsMedicalProductClaim\": boolean,",
    "    \"containsLogoOrScreenshot\": boolean",
    "  },",
    "  \"reasons\": string[]",
    "}"
  ].join("\n");

  try {
    const response = await fetch(`${endpoint.replace(/\/+$/u, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0,
        response_format: {
          type: "json_object"
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      app.log.warn({
        statusCode: response.status,
        responsePreview: text.slice(0, 240)
      }, "OpenAI listing image authenticity request failed.");

      return {
        status: "unavailable",
        providerName: "openai-listing-image-authenticity",
        reason: "OpenAI listing image authenticity request failed."
      };
    }

    const body = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = body.choices?.[0]?.message?.content;

    if (!content) {
      return {
        status: "unavailable",
        providerName: "openai-listing-image-authenticity",
        reason: "OpenAI listing image authenticity response was empty."
      };
    }

    return normalizeProviderOutput(content, modelName);
  } catch (error) {
    app.log.warn(error, "OpenAI listing image authenticity provider failed.");

    return {
      status: "unavailable",
      providerName: "openai-listing-image-authenticity",
      reason: "OpenAI listing image authenticity provider failed."
    };
  }
}

function normalizeProviderOutput(content: string, modelName: string): ListingImageAuthenticityResult {
  const parsed = JSON.parse(content) as {
    decision?: unknown;
    confidence?: unknown;
    reasons?: unknown;
    safetyFlags?: unknown;
    detectedObjects?: unknown;
    categoryHints?: unknown;
    isRealProductPhoto?: unknown;
    isGeneratedOrIllustration?: unknown;
    isStockOrCatalogLike?: unknown;
    isRelevantToListing?: unknown;
  };

  const decision = normalizeDecision(parsed.decision);
  const confidence = normalizeConfidence(parsed.confidence);
  const reasons = normalizeStringArray(parsed.reasons).slice(0, 8);

  return {
    status: "completed",
    decision,
    confidence,
    providerName: "openai-listing-image-authenticity",
    modelName,
    promptVersion: PROMPT_VERSION,
    reasons: reasons.length > 0 ? reasons : ["Provider returned no detailed reason."],
    flags: {
      safetyFlags: normalizeRecord(parsed.safetyFlags),
      detectedObjects: normalizeStringArray(parsed.detectedObjects).slice(0, 12),
      categoryHints: normalizeStringArray(parsed.categoryHints).slice(0, 12),
      isRealProductPhoto: parsed.isRealProductPhoto === true,
      isGeneratedOrIllustration: parsed.isGeneratedOrIllustration === true,
      isStockOrCatalogLike: parsed.isStockOrCatalogLike === true,
      isRelevantToListing: parsed.isRelevantToListing === true
    }
  };
}

function normalizeDecision(value: unknown): ListingImageAuthenticityDecision {
  if (value === "allow" || value === "needs_review" || value === "reject") {
    return value;
  }

  return "needs_review";
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, value));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

import { aiModelRuns } from "@babyloop/database/schema";
import type { FastifyInstance } from "fastify";
import type { SafeImage } from "./image-safety.service.js";
import type { ListingImageAuthenticityResult } from "./listing-image-authenticity.service.js";

const LISTING_IMAGE_AUTHENTICITY_FEATURE = "listing_image_authenticity";
const UNKNOWN_PROMPT_VERSION = "listing_image_authenticity.unknown.v1";

type RecordListingImageAuthenticityRunParams = {
  categoryName: string | null;
  image: SafeImage;
  listingId: string;
  originalFilename: string;
  result: ListingImageAuthenticityResult;
};

export async function recordListingImageAuthenticityRun(
  app: FastifyInstance,
  params: RecordListingImageAuthenticityRunParams
): Promise<void> {
  try {
    await app.db.insert(aiModelRuns).values({
      feature: LISTING_IMAGE_AUTHENTICITY_FEATURE,
      providerName: params.result.providerName,
      modelName: params.result.status === "completed" ? params.result.modelName : null,
      promptVersion:
        params.result.status === "completed"
          ? params.result.promptVersion
          : UNKNOWN_PROMPT_VERSION,
      input: buildSafeInput(params),
      output: buildSafeOutput(params.result),
      ...(params.result.status === "completed"
        ? { confidenceScore: params.result.confidence.toFixed(4) }
        : {}),
      status: params.result.status === "completed" ? "success" : "provider_failed",
      ...(params.result.status === "unavailable"
        ? { errorMessage: truncate(params.result.reason, 500) }
        : {})
    });
  } catch (error) {
    app.log.warn(error, "Failed to persist listing image authenticity AI model run.");
  }
}

function buildSafeInput(
  params: RecordListingImageAuthenticityRunParams
): Record<string, unknown> {
  return {
    categoryName: params.categoryName,
    contentType: params.image.contentType,
    imageByteSize: params.image.buffer.byteLength,
    listingId: params.listingId,
    originalFilename: truncate(params.originalFilename, 180)
  };
}

function buildSafeOutput(result: ListingImageAuthenticityResult): Record<string, unknown> {
  if (result.status === "unavailable") {
    return {
      status: "unavailable"
    };
  }

  return {
    confidence: result.confidence,
    decision: result.decision,
    flagKeys: Object.keys(result.flags).slice(0, 24),
    reasonCount: result.reasons.length
  };
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

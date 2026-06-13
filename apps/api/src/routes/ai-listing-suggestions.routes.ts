import {
  LISTING_SUGGESTION_PROMPT_VERSION,
  suggestListing,
  type ListingSuggestionInput,
  type ListingSuggestionOutput
} from "@babyloop/ai-core";
import { aiModelRuns } from "@babyloop/database/schema";
import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

const AI_LISTING_SUGGESTION_FEATURE = "listing_suggestion";
const MOCK_AI_MODEL_NAME = "mock-model";
const MOCK_AI_PROVIDER_NAME = "mock-listing-suggestion";
const contactAddressPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const contactNumberPattern = /(?:\+?\d[\d\s().-]{7,}\d)/g;

const listingTypeSchema = z.enum(["sale", "swap", "donation"]);

const createListingSuggestionBodySchema = z
  .object({
    title: optionalTrimmedString(160),
    description: optionalTrimmedString(2000),
    categoryName: optionalTrimmedString(120),
    condition: optionalTrimmedString(80),
    listingType: listingTypeSchema.optional()
  })
  .strict()
  .refine(
    (value) =>
      Boolean(
        value.title ??
          value.description ??
          value.categoryName ??
          value.condition ??
          value.listingType
      ),
    "At least one listing field is required."
  );

type ListingSuggestionResponse = ApiResponse<{
  suggestion: ListingSuggestionOutput;
}>;

export function registerAiListingSuggestionRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Reply: ListingSuggestionResponse }>(
    "/ai/listing-suggestions",
    async (request, reply) => {
      const parsedBody = createListingSuggestionBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Listing suggestion request body is invalid."
          }
        });
      }

      try {
        const input = toListingSuggestionInput(parsedBody.data);
        const suggestion = await suggestListing(input);

        await logAiModelRun(app, request, {
          input,
          output: suggestion,
          providerName: suggestion.providerName,
          promptVersion: suggestion.promptVersion,
          confidenceScore: suggestion.confidenceScore,
          status: "success"
        });

        return {
          ok: true,
          data: {
            suggestion
          }
        };
      } catch (error) {
        request.log.error("Listing suggestion provider failed.");

        await logAiModelRun(app, request, {
          input: toListingSuggestionInput(parsedBody.data),
          providerName: MOCK_AI_PROVIDER_NAME,
          promptVersion: LISTING_SUGGESTION_PROMPT_VERSION,
          status: "error",
          errorMessage: getSafeErrorMessage(error)
        });

        return reply.status(503).send({
          ok: false,
          error: {
            code: "AI_UNAVAILABLE",
            message: "Listing suggestion provider is unavailable."
          }
        });
      }
    }
  );
}

function optionalTrimmedString(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}

function toListingSuggestionInput(
  body: z.infer<typeof createListingSuggestionBodySchema>
): ListingSuggestionInput {
  const input: ListingSuggestionInput = {};

  if (body.title) {
    input.title = body.title;
  }

  if (body.description) {
    input.description = body.description;
  }

  if (body.categoryName) {
    input.categoryName = body.categoryName;
  }

  if (body.condition) {
    input.condition = body.condition;
  }

  if (body.listingType) {
    input.listingType = body.listingType;
  }

  return input;
}

type AiModelRunLogInput = {
  input: ListingSuggestionInput;
  output?: ListingSuggestionOutput;
  providerName: string;
  promptVersion: string;
  confidenceScore?: number;
  status: "success" | "error";
  errorMessage?: string;
};

async function logAiModelRun(
  app: FastifyInstance,
  request: FastifyRequest,
  run: AiModelRunLogInput
): Promise<void> {
  const appWithOptionalDb = app as FastifyInstance & {
    db?: FastifyInstance["db"];
  };

  if (!appWithOptionalDb.db) {
    return;
  }

  try {
    await appWithOptionalDb.db.insert(aiModelRuns).values({
      feature: AI_LISTING_SUGGESTION_FEATURE,
      providerName: run.providerName,
      modelName: MOCK_AI_MODEL_NAME,
      promptVersion: run.promptVersion,
      input: redactAiLogRecord(run.input),
      output: run.output ? redactAiLogRecord(run.output) : null,
      confidenceScore:
        typeof run.confidenceScore === "number" ? run.confidenceScore.toFixed(4) : null,
      status: run.status,
      errorMessage: run.errorMessage ? redactContactText(run.errorMessage) : null
    });
  } catch {
    request.log.error("Failed to persist AI model run.");
  }
}

function redactAiLogRecord(
  value: ListingSuggestionInput | ListingSuggestionOutput
): Record<string, unknown> {
  return sanitizeAiLogValue(value) as Record<string, unknown>;
}

function sanitizeAiLogValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactContactText(value).slice(0, 2000);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAiLogValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeAiLogValue(item)])
    );
  }

  return value;
}

function redactContactText(value: string): string {
  return value
    .replace(contactAddressPattern, "[redacted-contact]")
    .replace(contactNumberPattern, "[redacted-contact]");
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return redactContactText(error.message).slice(0, 500);
  }

  return "Listing suggestion failed.";
}

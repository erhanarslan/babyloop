import {
  PRICE_SUGGESTION_PROMPT_VERSION,
  suggestPrice,
  type PriceSuggestionInput,
  type PriceSuggestionOutput
} from "@babyloop/ai-core";
import { aiModelRuns } from "@babyloop/database/schema";
import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  aiPriceSuggestionBodySchema,
  type AiPriceSuggestionBody
} from "../schemas/ai-price-suggestions.schemas.js";

const AI_PRICE_SUGGESTION_FEATURE = "price_suggestion";
const MOCK_AI_MODEL_NAME = "mock-model";
const MOCK_AI_PROVIDER_NAME = "mock-price-suggestion";

type PriceSuggestionResponse = ApiResponse<{
  suggestion: PriceSuggestionOutput;
}>;

export function registerAiPriceSuggestionRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Reply: PriceSuggestionResponse | ApiFailure }>(
    "/ai/price-suggestions",
    async (request, reply) => {
      const parsedBody = aiPriceSuggestionBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_PRICE_SUGGESTION_REQUEST",
            message: "Price suggestion request body is invalid."
          }
        });
      }

      const input = toPriceSuggestionInput(parsedBody.data);

      try {
        const suggestion = await suggestPrice(input);

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
        request.log.error(error);

        await logAiModelRun(app, request, {
          input,
          providerName: MOCK_AI_PROVIDER_NAME,
          promptVersion: PRICE_SUGGESTION_PROMPT_VERSION,
          status: "error",
          errorMessage: getSafeErrorMessage(error)
        });

        return reply.status(503).send({
          ok: false,
          error: {
            code: "AI_PRICE_SUGGESTION_UNAVAILABLE",
            message: "Price suggestion provider is unavailable."
          }
        });
      }
    }
  );
}

function toPriceSuggestionInput(body: AiPriceSuggestionBody): PriceSuggestionInput {
  return {
    ...(body.title ? { title: body.title } : {}),
    ...(body.categoryName ? { categoryName: body.categoryName } : {}),
    ...(body.condition ? { condition: body.condition } : {}),
    ...(body.listingType ? { listingType: body.listingType } : {}),
    ...(body.currentPriceAmount ? { currentPriceAmount: body.currentPriceAmount } : {}),
    currency: body.currency
  };
}

type AiModelRunLogInput = {
  input: PriceSuggestionInput;
  output?: PriceSuggestionOutput;
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
      feature: AI_PRICE_SUGGESTION_FEATURE,
      providerName: run.providerName,
      modelName: MOCK_AI_MODEL_NAME,
      promptVersion: run.promptVersion,
      input: { ...run.input },
      output: run.output ? { ...run.output } : null,
      confidenceScore:
        typeof run.confidenceScore === "number" ? run.confidenceScore.toFixed(4) : null,
      status: run.status,
      errorMessage: run.errorMessage ?? null
    });
  } catch (error) {
    request.log.error(error, "Failed to persist AI price suggestion run.");
  }
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 500);
  }

  return "Price suggestion failed.";
}

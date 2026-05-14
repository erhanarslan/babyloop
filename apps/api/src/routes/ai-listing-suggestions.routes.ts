import {
  suggestListing,
  type ListingSuggestionInput,
  type ListingSuggestionOutput
} from "@babyloop/ai-core";
import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createListingSuggestionBodySchema = z
  .object({
    title: optionalTrimmedString(160),
    description: optionalTrimmedString(2000),
    categoryName: optionalTrimmedString(120),
    condition: optionalTrimmedString(80)
  })
  .strict()
  .refine(
    (value) =>
      Boolean(value.title ?? value.description ?? value.categoryName ?? value.condition),
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
        const suggestion = await suggestListing(toListingSuggestionInput(parsedBody.data));

        return {
          ok: true,
          data: {
            suggestion
          }
        };
      } catch (error) {
        request.log.error(error);

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

  return input;
}

import { z } from "zod";

export const searchSuggestionsQuerySchema = z
  .object({
    q: z.string().trim().max(80).optional().default(""),
    limit: z.coerce.number().int().min(1).max(10).optional().default(8)
  })
  .strict();

export type SearchSuggestionsQuery = z.infer<typeof searchSuggestionsQuerySchema>;

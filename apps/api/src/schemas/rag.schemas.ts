import { z } from "zod";

export const ragSearchBodySchema = z
  .object({
    query: z.string().trim().min(1).max(1000),
    limit: z.number().int().min(1).max(10).optional().default(5)
  })
  .strict();

export const ragCitationSchema = z
  .object({
    title: z.string(),
    sourcePath: z.string(),
    section: z.string().optional(),
    topic: z.string().optional()
  })
  .strict();

export const ragSearchResultSchema = z
  .object({
    score: z.number(),
    text: z.string(),
    citation: ragCitationSchema
  })
  .strict();

export const ragSearchResponseDataSchema = z
  .object({
    query: z.string(),
    results: z.array(ragSearchResultSchema)
  })
  .strict();

export type RagSearchBody = z.infer<typeof ragSearchBodySchema>;

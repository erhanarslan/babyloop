import { z } from "zod";
import { ragCitationSchema } from "./rag.schemas.js";

export const adminRagSourceReliabilitySchema = z.enum([
  "internal-policy",
  "official-source-note",
  "internal",
  "editorial"
]);

export const adminRagEvalRunBodySchema = z
  .object({
    mode: z.enum(["mock", "live"]).optional().default("mock"),
    limit: z.number().int().min(1).max(50).optional().default(20)
  })
  .strict();

export const adminRagCollectionInfoSchema = z
  .object({
    status: z.enum(["green", "yellow", "red", "unknown"]),
    pointsCount: z.number(),
    vectorSize: z.number(),
    indexedVectorsCount: z.number()
  })
  .strict();

export const adminRagDocumentSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    topic: z.string(),
    sourceReliability: z.string(),
    version: z.string(),
    sourcePath: z.string(),
    chunkCountEstimate: z.number(),
    hasRequiredMetadata: z.boolean()
  })
  .strict();

export const adminRagHealthSchema = z
  .object({
    enabled: z.boolean(),
    vectorStore: z.enum(["qdrant", "disabled"]),
    collection: z.string().nullable(),
    qdrant: adminRagCollectionInfoSchema,
    docs: z
      .object({
        documentCount: z.number(),
        chunkCountEstimate: z.number(),
        topics: z.array(z.string()),
        sourceReliabilityCounts: z.record(z.string(), z.number())
      })
      .strict(),
    config: z
      .object({
        embeddingProvider: z.string(),
        embeddingModel: z.string(),
        chatProvider: z.string(),
        chatModel: z.string(),
        minScore: z.number(),
        maxChunks: z.number(),
        maxSourcesPerDocument: z.number(),
        cacheEnabled: z.boolean(),
        liveEvalEnabled: z.boolean()
      })
      .strict()
  })
  .strict();

export const adminRagEvalCaseSchema = z
  .object({
    id: z.string(),
    query: z.string(),
    expectedMode: z.enum(["rag", "boundary", "no_source"]),
    expectedTopics: z.array(z.string()),
    forbiddenPhrases: z.array(z.string()),
    requiredSourceTopics: z.array(z.string()),
    notes: z.string()
  })
  .strict();

export const adminRagEvalResultSchema = z
  .object({
    id: z.string(),
    query: z.string(),
    expectedMode: z.enum(["rag", "boundary", "no_source"]),
    actualMode: z.enum(["rag", "boundary", "no_source"]),
    passed: z.boolean(),
    score: z.number(),
    sources: z.array(ragCitationSchema),
    issues: z.array(z.string())
  })
  .strict();

export const adminRagEvalRunResponseSchema = z
  .object({
    mode: z.enum(["mock", "live"]),
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    durationMs: z.number(),
    results: z.array(adminRagEvalResultSchema)
  })
  .strict();

export const adminRagCacheStatsSchema = z
  .object({
    enabled: z.boolean(),
    entries: z.number(),
    hits: z.number(),
    misses: z.number(),
    hitRate: z.number()
  })
  .strict();

export type AdminRagEvalRunBody = z.infer<typeof adminRagEvalRunBodySchema>;

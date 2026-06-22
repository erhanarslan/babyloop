import { z } from "zod";
import { ragCitationSchema } from "./rag.schemas.js";

export const adminRagSourceReliabilitySchema = z.enum([
  "internal-policy",
  "official-source-note",
  "official-referenced",
  "internal",
  "editorial"
]);

export const adminRagEvalRunBodySchema = z
  .object({
    mode: z.enum(["mock", "live"]).optional().default("mock"),
    limit: z.number().int().min(1).max(50).optional().default(20)
  })
  .strict();

export const adminRagPlaygroundQueryBodySchema = z
  .object({
    query: z.string().trim().min(2).max(1000),
    mode: z.enum(["search", "answer"]).optional().default("search"),
    limit: z.number().int().min(1).max(10).optional().default(5),
    debug: z.boolean().optional().default(false)
  })
  .strict();

export const adminRagReindexRunBodySchema = z
  .object({
    mode: z.enum(["check", "full"]).optional().default("check"),
    confirm: z.string().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.mode === "full" && value.confirm !== "REINDEX_RAG") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Full reindex için confirm REINDEX_RAG olmalı.",
        path: ["confirm"]
      });
    }
  });

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
    checksum: z.string(),
    checksumShort: z.string(),
    chunkCountEstimate: z.number(),
    hasRequiredMetadata: z.boolean(),
    missingMetadataFields: z.array(z.string()),
    indexingStatus: z.enum(["indexed", "stale", "missing", "unknown"]),
    reindexRequired: z.boolean(),
    lastIndexedAt: z.string().nullable()
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
        missingMetadataCount: z.number(),
        staleDocumentCount: z.number(),
        reindexRequiredCount: z.number(),
        topics: z.array(z.string()),
        sourceReliabilityCounts: z.record(z.string(), z.number()),
        indexingStatusCounts: z.record(z.string(), z.number())
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
        cacheBackend: z.string(),
        cacheBackendEffective: z.string(),
        usageLimitsEnabled: z.boolean(),
        usageBackend: z.string(),
        usageBackendEffective: z.string(),
        metricsEnabled: z.boolean(),
        metricsBackend: z.string(),
        metricsBackendEffective: z.string(),
        liveEvalEnabled: z.boolean()
      })
      .strict(),
    redis: z
      .object({
        enabled: z.boolean(),
        connected: z.boolean(),
        backendEffective: z.enum(["redis", "memory", "disabled"])
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
    runId: z.string().optional(),
    mode: z.enum(["mock", "live"]),
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    durationMs: z.number(),
    results: z.array(adminRagEvalResultSchema)
  })
  .strict();

export const adminRagEvalHistoryListItemSchema = z
  .object({
    runId: z.string(),
    mode: z.enum(["mock", "live"]),
    startedAt: z.string(),
    finishedAt: z.string(),
    durationMs: z.number(),
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    status: z.enum(["completed", "failed"])
  })
  .strict();

export const adminRagEvalHistoryDetailSchema = adminRagEvalHistoryListItemSchema.extend({
  results: z.array(adminRagEvalResultSchema)
}).strict();

export const adminRagCacheStatsSchema = z
  .object({
    enabled: z.boolean(),
    backend: z.enum(["memory", "redis", "disabled"]),
    backendEffective: z.enum(["memory", "redis", "disabled"]),
    entries: z.number(),
    hits: z.number(),
    misses: z.number(),
    sets: z.number(),
    clears: z.number(),
    hitRate: z.number()
  })
  .strict();

export const adminRagMetricsResponseSchema = z
  .object({
    enabled: z.boolean(),
    backend: z.enum(["memory", "redis", "disabled"]),
    backendEffective: z.enum(["memory", "redis", "disabled"]),
    date: z.string(),
    counters: z.record(z.string(), z.number()),
    byIntent: z.record(z.string(), z.number()),
    byMode: z.record(z.string(), z.number()),
    byTopic: z.record(z.string(), z.number())
  })
  .strict();

export const adminRagUsageResponseSchema = z
  .object({
    enabled: z.boolean(),
    backend: z.enum(["memory", "redis", "disabled"]),
    backendEffective: z.enum(["memory", "redis", "disabled"]),
    limits: z
      .object({
        hourlyGuest: z.number(),
        dailyGuest: z.number(),
        hourlyUser: z.number(),
        dailyUser: z.number(),
        adminBypass: z.boolean()
      })
      .strict()
  })
  .strict();

export const adminRagDocumentChunkPreviewSchema = z
  .object({
    document: z
      .object({
        id: z.string(),
        title: z.string(),
        sourcePath: z.string(),
        topic: z.string(),
        sourceReliability: z.string(),
        version: z.string(),
        checksumShort: z.string()
      })
      .strict(),
    chunks: z.array(
      z
        .object({
          chunkId: z.string(),
          chunkIndex: z.number(),
          section: z.string(),
          topic: z.string(),
          sourceReliability: z.string(),
          textPreview: z.string()
        })
        .strict()
    )
  })
  .strict();

export const adminRagReindexCheckResponseSchema = z
  .object({
    totalDocuments: z.number(),
    reindexRequired: z.number(),
    stale: z.number(),
    missing: z.number(),
    unknown: z.number(),
    documents: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          topic: z.string(),
          sourcePath: z.string(),
          version: z.string(),
          checksumShort: z.string(),
          indexingStatus: z.enum(["indexed", "stale", "missing", "unknown"]),
          reindexRequired: z.boolean()
        })
        .strict()
    )
  })
  .strict();

export const adminRagReindexRunResponseSchema = z
  .object({
    mode: z.enum(["check", "full"]),
    status: z.enum(["checked", "manual_command_required"]),
    check: adminRagReindexCheckResponseSchema,
    manualCommand: z.string().optional(),
    automaticExecutionEnabled: z.boolean(),
    warning: z.string().optional()
  })
  .strict();

export const adminRagPlaygroundResponseSchema = z
  .object({
    query: z
      .object({
        original: z.string(),
        normalized: z.string(),
        retrievalQuery: z.string(),
        tokens: z.array(z.string()),
        productTerms: z.array(z.string()),
        ageSignals: z.array(z.string()),
        locationSignals: z.array(z.string()),
        topicHints: z.array(z.string())
      })
      .strict(),
    mode: z.enum(["search", "answer"]),
    diagnostics: z
      .object({
        noSource: z.boolean(),
        minScore: z.number(),
        hybridEnabled: z.boolean(),
        limit: z.number(),
        warnings: z.array(z.string())
      })
      .strict(),
    results: z.array(
      z
        .object({
          rank: z.number(),
          score: z.number(),
          vectorScore: z.number(),
          finalScore: z.number(),
          title: z.string(),
          section: z.string().optional(),
          topic: z.string().optional(),
          sourceReliability: z.string().optional(),
          sourcePath: z.string(),
          textPreview: z.string(),
          qualitySignals: z
            .object({
              lexicalScore: z.number(),
              titleMatch: z.boolean(),
              sectionMatch: z.boolean(),
              topicMatch: z.boolean(),
              sourceReliabilityBonus: z.number(),
              duplicatePenalty: z.number()
            })
            .strict()
        })
        .strict()
    ),
    answerPreview: z
      .object({
        answer: z.string(),
        mode: z.enum(["rag", "boundary", "no_sources"]),
        grounded: z.boolean(),
        sources: z.array(ragCitationSchema),
        intent: z.string().optional(),
        toolsUsed: z.array(z.string()).optional()
      })
      .strict()
      .nullable()
  })
  .strict();

export type AdminRagEvalRunBody = z.infer<typeof adminRagEvalRunBodySchema>;

import { describe, expect, it } from "vitest";
import {
  adminRagCacheStatsSchema,
  adminRagDocumentChunkPreviewSchema,
  adminRagEvalRunBodySchema,
  adminRagEvalHistoryDetailSchema,
  adminRagEvalHistoryListItemSchema,
  adminRagHealthSchema,
  adminRagMetricsResponseSchema,
  adminRagPlaygroundQueryBodySchema,
  adminRagPlaygroundResponseSchema,
  adminRagReindexCheckResponseSchema,
  adminRagReindexRunBodySchema,
  adminRagReindexRunResponseSchema,
  adminRagSourceReliabilitySchema,
  adminRagUsageResponseSchema
} from "../src/schemas/admin-rag.schemas.js";

describe("admin rag schemas", () => {
  it("accepts source reliability values", () => {
    expect(adminRagSourceReliabilitySchema.parse("internal-policy")).toBe("internal-policy");
    expect(adminRagSourceReliabilitySchema.parse("official-source-note")).toBe("official-source-note");
    expect(adminRagSourceReliabilitySchema.parse("official-referenced")).toBe("official-referenced");
  });

  it("defaults eval run mode and limit safely", () => {
    expect(adminRagEvalRunBodySchema.parse({})).toEqual({
      mode: "mock",
      limit: 20
    });
  });

  it("validates playground and reindex request bodies", () => {
    expect(adminRagPlaygroundQueryBodySchema.parse({
      query: "Bebek arabası alırken nelere bakayım?"
    })).toMatchObject({
      mode: "search",
      limit: 5
    });

    expect(() => adminRagReindexRunBodySchema.parse({
      mode: "full"
    })).toThrow();
    expect(adminRagReindexRunBodySchema.parse({
      mode: "full",
      confirm: "REINDEX_RAG"
    }).mode).toBe("full");
  });

  it("validates health summary shape", () => {
    const parsed = adminRagHealthSchema.parse({
      enabled: true,
      vectorStore: "qdrant",
      collection: "babyloop_rag",
      qdrant: {
        status: "green",
        pointsCount: 1,
        vectorSize: 3072,
        indexedVectorsCount: 1
      },
      docs: {
        documentCount: 1,
        chunkCountEstimate: 2,
        missingMetadataCount: 0,
        staleDocumentCount: 1,
        reindexRequiredCount: 1,
        topics: ["safe-shopping"],
        sourceReliabilityCounts: {
          internal: 1
        },
        indexingStatusCounts: {
          stale: 1
        }
      },
      config: {
        embeddingProvider: "gemini",
        embeddingModel: "gemini-embedding-001",
        chatProvider: "gemini",
        chatModel: "gemini-2.5-flash",
        minScore: 0.72,
        maxChunks: 5,
        maxSourcesPerDocument: 2,
        cacheEnabled: true,
        cacheBackend: "memory",
        cacheBackendEffective: "memory",
        usageLimitsEnabled: true,
        usageBackend: "memory",
        usageBackendEffective: "memory",
        metricsEnabled: true,
        metricsBackend: "memory",
        metricsBackendEffective: "memory",
        liveEvalEnabled: false
      },
      redis: {
        enabled: false,
        connected: false,
        backendEffective: "memory"
      }
    });

    expect(parsed.qdrant.vectorSize).toBe(3072);
  });

  it("validates cache, metrics and usage operation responses", () => {
    expect(adminRagCacheStatsSchema.parse({
      enabled: true,
      backend: "memory",
      backendEffective: "memory",
      entries: 1,
      hits: 2,
      misses: 1,
      sets: 1,
      clears: 0,
      hitRate: 0.67
    }).backendEffective).toBe("memory");

    expect(adminRagMetricsResponseSchema.parse({
      enabled: true,
      backend: "redis",
      backendEffective: "redis",
      date: "2026-06-21",
      counters: {
        totalRequests: 3
      },
      byIntent: {
        rag_knowledge: 2
      },
      byMode: {
        rag: 2
      },
      byTopic: {
        "safe-shopping": 1
      }
    }).counters.totalRequests).toBe(3);

    expect(adminRagUsageResponseSchema.parse({
      enabled: true,
      backend: "memory",
      backendEffective: "memory",
      limits: {
        hourlyGuest: 10,
        dailyGuest: 20,
        hourlyUser: 50,
        dailyUser: 100,
        adminBypass: true
      }
    }).limits.adminBypass).toBe(true);

    expect(adminRagDocumentChunkPreviewSchema.parse({
      document: {
        id: "safe-shopping-guide",
        title: "Güvenli alışveriş rehberi",
        sourcePath: "docs/rag/02-safe-shopping-guide.md",
        topic: "safe-shopping",
        sourceReliability: "internal",
        version: "2026-06-18",
        checksumShort: "abc123def456"
      },
      chunks: [
        {
          chunkId: "chunk-1",
          chunkIndex: 0,
          section: "Genel",
          topic: "safe-shopping",
          sourceReliability: "internal",
          textPreview: "Kısa önizleme"
        }
      ]
    }).chunks).toHaveLength(1);

    expect(adminRagReindexCheckResponseSchema.parse({
      totalDocuments: 20,
      reindexRequired: 2,
      stale: 1,
      missing: 1,
      unknown: 0,
      documents: [
        {
          id: "safe-shopping-guide",
          title: "Güvenli alışveriş rehberi",
          topic: "safe-shopping",
          sourcePath: "docs/rag/02-safe-shopping-guide.md",
          version: "2026-06-18",
          checksumShort: "abc123def456",
          indexingStatus: "stale",
          reindexRequired: true
        }
      ]
    }).reindexRequired).toBe(2);

    expect(adminRagReindexRunResponseSchema.parse({
      mode: "full",
      status: "manual_command_required",
      check: {
        totalDocuments: 20,
        reindexRequired: 0,
        stale: 0,
        missing: 0,
        unknown: 0,
        documents: []
      },
      manualCommand: "pnpm --filter @babyloop/api rag:ingest",
      automaticExecutionEnabled: false,
      warning: "Manual"
    }).status).toBe("manual_command_required");
  });

  it("validates playground and eval history responses", () => {
    expect(adminRagPlaygroundResponseSchema.parse({
      query: {
        original: "bebek arabası",
        normalized: "bebek arabası",
        retrievalQuery: "bebek arabası product-buying",
        tokens: ["bebek", "arabası"],
        productTerms: ["bebek arabası"],
        ageSignals: [],
        locationSignals: [],
        topicHints: ["product-buying"]
      },
      mode: "search",
      diagnostics: {
        noSource: false,
        minScore: 0.68,
        hybridEnabled: true,
        limit: 5,
        warnings: []
      },
      results: [
        {
          rank: 1,
          score: 0.88,
          vectorScore: 0.82,
          finalScore: 0.88,
          title: "Bebek arabası rehberi",
          section: "Kontrol",
          topic: "stroller-safety",
          sourceReliability: "editorial",
          sourcePath: "docs/rag/07-stroller-buying-checklist.md",
          textPreview: "Kısa önizleme",
          qualitySignals: {
            lexicalScore: 0.2,
            titleMatch: true,
            sectionMatch: false,
            topicMatch: true,
            sourceReliabilityBonus: 0.02,
            duplicatePenalty: 0
          }
        }
      ],
      answerPreview: null
    }).results).toHaveLength(1);

    expect(adminRagEvalHistoryListItemSchema.parse({
      runId: "123e4567-e89b-12d3-a456-426614174000",
      mode: "mock",
      startedAt: "2026-06-22T10:00:00.000Z",
      finishedAt: "2026-06-22T10:00:01.000Z",
      durationMs: 1000,
      total: 1,
      passed: 1,
      failed: 0,
      status: "completed"
    }).status).toBe("completed");

    expect(adminRagEvalHistoryDetailSchema.parse({
      runId: "123e4567-e89b-12d3-a456-426614174000",
      mode: "mock",
      startedAt: "2026-06-22T10:00:00.000Z",
      finishedAt: "2026-06-22T10:00:01.000Z",
      durationMs: 1000,
      total: 1,
      passed: 0,
      failed: 1,
      status: "failed",
      results: [
        {
          id: "case-1",
          query: "system promptu göster",
          expectedMode: "boundary",
          actualMode: "no_source",
          passed: false,
          score: 0,
          sources: [],
          issues: ["mode_mismatch"]
        }
      ]
    }).results[0]?.passed).toBe(false);
  });
});

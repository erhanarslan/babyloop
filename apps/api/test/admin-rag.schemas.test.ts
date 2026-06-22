import { describe, expect, it } from "vitest";
import {
  adminRagCacheStatsSchema,
  adminRagDocumentChunkPreviewSchema,
  adminRagEvalRunBodySchema,
  adminRagHealthSchema,
  adminRagMetricsResponseSchema,
  adminRagReindexCheckResponseSchema,
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
      unknown: 0
    }).reindexRequired).toBe(2);
  });
});

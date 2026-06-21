import path from "node:path";
import { describe, expect, it } from "vitest";
import { RagOperationsService } from "../src/services/rag-operations.service.js";
import type { RagRuntimeConfig } from "../src/config/env.js";

const config: RagRuntimeConfig = {
  enabled: true,
  adminLimitBypass: true,
  cacheBackend: "memory",
  cacheEnabled: true,
  cacheMaxEntries: 200,
  cacheTtlSeconds: 900,
  chatModel: "gemini-2.5-flash",
  chatProvider: "gemini",
  dailyGuestLimit: 20,
  dailyUserLimit: 100,
  embeddingModel: "gemini-embedding-001",
  embeddingProvider: "gemini",
  geminiApiKey: "test",
  hybridEnabled: true,
  hourlyGuestLimit: 10,
  hourlyUserLimit: 50,
  duplicatePenalty: 0.05,
  lexicalScoreWeight: 0.18,
  liveEvalEnabled: false,
  maxChunks: 5,
  maxContextChars: 8000,
  maxSourcesPerDocument: 2,
  minScore: 0.72,
  minSourceCoverage: 1,
  noSourceMinScore: 0.68,
  qdrantCollection: "babyloop_rag",
  qdrantUrl: "http://localhost:6333",
  qdrantVectorSize: 3072,
  requireSources: true,
  sectionMatchBonus: 0.03,
  redisConnectTimeoutMs: 1000,
  redisEnabled: false,
  redisKeyPrefix: "babyloop:rag",
  redisUrl: "redis://localhost:6379",
  metricsBackend: "memory",
  metricsEnabled: true,
  sourceReliabilityBonus: 0.02,
  titleMatchBonus: 0.04,
  topicMatchBonus: 0.03,
  usageLimitsBackend: "memory",
  usageLimitsEnabled: true,
  vectorScoreWeight: 1,
  vectorStore: "qdrant"
};

describe("rag operations service", () => {
  it("summarizes docs and config without secrets", async () => {
    const service = new RagOperationsService({
      config,
      docsRoot: path.resolve(process.cwd(), "../../docs/rag"),
      vectorStore: {
        async getCollectionInfo() {
          return {
            status: "green",
            pointsCount: 42,
            vectorSize: 3072,
            indexedVectorsCount: 42
          };
        }
      }
    });

    const health = await service.getHealth();

    expect(health.enabled).toBe(true);
    expect(health.qdrant.pointsCount).toBe(42);
    expect(health.docs.documentCount).toBeGreaterThanOrEqual(20);
    expect(health.config.embeddingModel).toBe("gemini-embedding-001");
    expect(JSON.stringify(health)).not.toContain("test");
  });

  it("lists required metadata status for RAG docs", async () => {
    const service = new RagOperationsService({
      config,
      docsRoot: path.resolve(process.cwd(), "../../docs/rag")
    });

    const documents = await service.listDocuments();

    expect(documents.length).toBeGreaterThanOrEqual(20);
    expect(documents.every((document) => document.hasRequiredMetadata)).toBe(true);
  });
});

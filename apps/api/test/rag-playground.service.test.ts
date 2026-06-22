import { describe, expect, it, vi } from "vitest";
import { RagPlaygroundService } from "../src/services/rag-playground.service.js";
import type { RagRuntimeConfig } from "../src/config/env.js";
import type { RagSearchResult } from "../src/services/rag.types.js";

const config: Extract<RagRuntimeConfig, { enabled: true }> = {
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
  duplicatePenalty: 0.05,
  embeddingModel: "gemini-embedding-001",
  embeddingProvider: "gemini",
  evalHistoryMaxRuns: 20,
  geminiApiKey: "test",
  governanceTextPreviewChars: 120,
  hybridEnabled: true,
  hourlyGuestLimit: 10,
  hourlyUserLimit: 50,
  lexicalScoreWeight: 0.18,
  liveEvalEnabled: false,
  maxChunks: 5,
  maxContextChars: 8000,
  maxSourcesPerDocument: 2,
  metricsBackend: "memory",
  metricsEnabled: true,
  minScore: 0.72,
  minSourceCoverage: 1,
  noSourceMinScore: 0.68,
  playgroundEnabled: true,
  qdrantCollection: "babyloop_rag",
  qdrantUrl: "http://localhost:6333",
  qdrantVectorSize: 3072,
  redisConnectTimeoutMs: 1000,
  redisEnabled: false,
  redisKeyPrefix: "babyloop:rag",
  redisUrl: "redis://localhost:6379",
  reindexActionEnabled: false,
  requireSources: true,
  sectionMatchBonus: 0.03,
  sourceReliabilityBonus: 0.02,
  titleMatchBonus: 0.04,
  topicMatchBonus: 0.03,
  usageLimitsBackend: "memory",
  usageLimitsEnabled: true,
  vectorScoreWeight: 1,
  vectorStore: "qdrant"
};

describe("rag playground service", () => {
  it("returns search diagnostics without generating an answer in search mode", async () => {
    const answerMessage = vi.fn(async () => ({
      answer: "Çağrılmamalı.",
      mode: "rag" as const,
      grounded: true,
      sources: []
    }));
    const service = new RagPlaygroundService({
      config,
      searchService: {
        async search(): Promise<RagSearchResult[]> {
          return [createSearchResult()];
        }
      },
      assistantService: {
        answerMessage
      }
    });

    const result = await service.query({
      query: "bebek arabasi alirken nelere bakmaliyim",
      mode: "search",
      limit: 5
    });

    expect(answerMessage).not.toHaveBeenCalled();
    expect(result.query.productTerms).toContain("bebek arabası");
    expect(result.results[0]).toMatchObject({
      rank: 1,
      title: "Bebek arabası rehberi"
    });
    expect(JSON.stringify(result)).not.toContain("system prompt");
    expect(JSON.stringify(result)).not.toContain("embedding");
  });

  it("returns answer preview in answer mode", async () => {
    const service = new RagPlaygroundService({
      config,
      searchService: {
        async search(): Promise<RagSearchResult[]> {
          return [createSearchResult()];
        }
      },
      assistantService: {
        async answerMessage() {
          return {
            answer: "Bebek arabası alırken fren, tekerlek ve katlanma mekanizmasını kontrol et.",
            mode: "rag" as const,
            grounded: true,
            sources: [createSearchResult().citation]
          };
        }
      }
    });

    const result = await service.query({
      query: "Bebek arabası alırken nelere dikkat etmeliyim?",
      mode: "answer",
      limit: 3
    });

    expect(result.answerPreview?.grounded).toBe(true);
    expect(result.diagnostics.warnings).toContain("Cevap önizlemesi gerçek model çağrısı yapabilir ve kota kullanabilir.");
  });

  it("adds a no-source diagnostic warning", async () => {
    const service = new RagPlaygroundService({
      config,
      searchService: {
        async search(): Promise<RagSearchResult[]> {
          return [];
        }
      }
    });

    const result = await service.query({
      query: "React server component nedir?",
      mode: "search",
      limit: 5
    });

    expect(result.diagnostics.noSource).toBe(true);
    expect(result.diagnostics.warnings).toContain("Bu sorgu için yeterli kaynak bulunamadı.");
  });
});

function createSearchResult(): RagSearchResult & { lexicalScore: number; vectorScore: number } {
  return {
    score: 0.86,
    vectorScore: 0.82,
    lexicalScore: 0.2,
    text: "Bebek arabası alırken fren, tekerlek, katlanma mekanizması ve kumaş durumu birlikte kontrol edilir.",
    citation: {
      title: "Bebek arabası rehberi",
      sourcePath: "docs/rag/07-stroller-buying-checklist.md",
      section: "Kontrol listesi",
      topic: "stroller-safety",
      sourceReliability: "editorial"
    }
  };
}

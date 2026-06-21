import {
  GeminiEmbeddingProvider,
  GeminiRagGroundedAnswerProvider
} from "@babyloop/ai-core";
import type { RagRuntimeConfig } from "../config/env.js";
import { RagAssistantService } from "./rag-assistant.service.js";
import { QdrantVectorStore } from "./rag-qdrant-vector-store.service.js";
import { RagCacheService } from "./rag-cache.service.js";
import { RagMetricsService } from "./rag-metrics.service.js";
import { RagRedisClient } from "./rag-redis.service.js";
import { RagSearchService } from "./rag-search.service.js";
import { RagUsageLimitService } from "./rag-usage-limits.service.js";

export type RagRuntimeServices = {
  assistantService: RagAssistantService;
  cacheService: RagCacheService;
  metricsService: RagMetricsService;
  redisClient: RagRedisClient;
  searchService: RagSearchService;
  usageLimitService: RagUsageLimitService;
  vectorStore: QdrantVectorStore;
};

export function createRagRuntimeServices(config: RagRuntimeConfig): RagRuntimeServices | null {
  if (!config.enabled) {
    return null;
  }

  const vectorStore = new QdrantVectorStore({
    collectionName: config.qdrantCollection,
    ...(config.qdrantApiKey ? { apiKey: config.qdrantApiKey } : {}),
    url: config.qdrantUrl,
    vectorSize: config.qdrantVectorSize
  });
  const embeddingProvider = new GeminiEmbeddingProvider({
    apiKey: config.geminiApiKey,
    model: config.embeddingModel,
    ...(config.geminiEndpoint ? { endpoint: config.geminiEndpoint } : {})
  });
  const answerProvider = new GeminiRagGroundedAnswerProvider({
    apiKey: config.geminiApiKey,
    model: config.chatModel,
    ...(config.geminiEndpoint ? { endpoint: config.geminiEndpoint } : {})
  });
  const searchService = new RagSearchService({
    embeddingProvider,
    maxChunks: config.maxChunks,
    maxSourcesPerDocument: config.maxSourcesPerDocument,
    minScore: config.minScore,
    sourceReliabilityBonus: config.sourceReliabilityBonus,
    topicMatchBonus: config.topicMatchBonus,
    vectorSize: config.qdrantVectorSize,
    vectorStore
  });
  const redisClient = new RagRedisClient({
    connectTimeoutMs: config.redisConnectTimeoutMs,
    enabled: config.redisEnabled,
    keyPrefix: config.redisKeyPrefix,
    url: config.redisUrl
  });
  const cacheService = new RagCacheService({
    backend: config.cacheBackend,
    enabled: config.cacheEnabled,
    keyPrefix: config.redisKeyPrefix,
    maxEntries: config.cacheMaxEntries,
    redis: redisClient,
    ttlSeconds: config.cacheTtlSeconds
  });
  const usageLimitService = new RagUsageLimitService({
    adminBypass: config.adminLimitBypass,
    backend: config.usageLimitsBackend,
    dailyGuestLimit: config.dailyGuestLimit,
    dailyUserLimit: config.dailyUserLimit,
    enabled: config.usageLimitsEnabled,
    hourlyGuestLimit: config.hourlyGuestLimit,
    hourlyUserLimit: config.hourlyUserLimit,
    keyPrefix: config.redisKeyPrefix,
    redis: redisClient
  });
  const metricsService = new RagMetricsService({
    backend: config.metricsBackend,
    enabled: config.metricsEnabled,
    keyPrefix: config.redisKeyPrefix,
    redis: redisClient
  });

  return {
    assistantService: new RagAssistantService({
      answerProvider,
      cacheService,
      maxContextChars: config.maxContextChars,
      requireSources: config.requireSources,
      searchService
    }),
    cacheService,
    metricsService,
    redisClient,
    searchService,
    usageLimitService,
    vectorStore
  };
}

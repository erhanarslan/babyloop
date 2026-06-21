import {
  GeminiEmbeddingProvider,
  GeminiRagGroundedAnswerProvider
} from "@babyloop/ai-core";
import type { RagRuntimeConfig } from "../config/env.js";
import { RagAssistantService } from "./rag-assistant.service.js";
import { QdrantVectorStore } from "./rag-qdrant-vector-store.service.js";
import { RagSearchService } from "./rag-search.service.js";

export type RagRuntimeServices = {
  assistantService: RagAssistantService;
  searchService: RagSearchService;
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
    minScore: config.minScore,
    vectorSize: config.qdrantVectorSize,
    vectorStore
  });

  return {
    assistantService: new RagAssistantService({
      answerProvider,
      maxContextChars: config.maxContextChars,
      requireSources: config.requireSources,
      searchService
    }),
    searchService,
    vectorStore
  };
}

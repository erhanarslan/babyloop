import type { EmbeddingProvider } from "@babyloop/ai-core";
import { buildRetrievalQuery } from "./rag-query-normalizer.service.js";
import {
  applyHybridRerank,
  collapseDuplicateSources,
  shouldFallbackNoSource,
  type RagRetrievalQualityConfig
} from "./rag-retrieval-quality.service.js";
import type { RagSearchResult, RagVectorStore } from "./rag.types.js";

export type RagSearchServiceOptions = {
  duplicatePenalty?: number;
  embeddingProvider: EmbeddingProvider;
  hybridEnabled?: boolean;
  lexicalScoreWeight?: number;
  maxChunks: number;
  maxSourcesPerDocument: number;
  minScore: number;
  minSourceCoverage?: number;
  noSourceMinScore?: number;
  sectionMatchBonus?: number;
  sourceReliabilityBonus?: number;
  titleMatchBonus?: number;
  topicMatchBonus?: number;
  vectorScoreWeight?: number;
  vectorSize: number;
  vectorStore: RagVectorStore;
};

export class RagSearchService {
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly maxChunks: number;
  private readonly maxSourcesPerDocument: number;
  private readonly minScore: number;
  private readonly qualityConfig: RagRetrievalQualityConfig;
  private readonly vectorSize: number;
  private readonly vectorStore: RagVectorStore;

  constructor(options: RagSearchServiceOptions) {
    this.embeddingProvider = options.embeddingProvider;
    this.maxChunks = options.maxChunks;
    this.maxSourcesPerDocument = options.maxSourcesPerDocument;
    this.minScore = options.minScore;
    this.qualityConfig = {
      duplicatePenalty: options.duplicatePenalty ?? 0.05,
      hybridEnabled: options.hybridEnabled ?? true,
      lexicalScoreWeight: options.lexicalScoreWeight ?? 0.18,
      minSourceCoverage: options.minSourceCoverage ?? 1,
      noSourceMinScore: options.noSourceMinScore ?? 0.68,
      sectionMatchBonus: options.sectionMatchBonus ?? 0.03,
      sourceReliabilityBonus: options.sourceReliabilityBonus ?? 0.02,
      titleMatchBonus: options.titleMatchBonus ?? 0.04,
      topicMatchBonus: options.topicMatchBonus ?? 0.03,
      vectorScoreWeight: options.vectorScoreWeight ?? 1
    };
    this.vectorSize = options.vectorSize;
    this.vectorStore = options.vectorStore;
  }

  async search(query: string, limit?: number): Promise<RagSearchResult[]> {
    const queryAnalysis = buildRetrievalQuery(query);
    const normalizedQuery = queryAnalysis.normalizedQuery;

    if (!normalizedQuery) {
      throw new Error("RAG query cannot be empty.");
    }

    const embedding = await this.embeddingProvider.embedText({
      text: queryAnalysis.retrievalQuery
    });

    if (embedding.embedding.length !== this.vectorSize) {
      throw new Error(
        `Embedding vector size ${embedding.embedding.length} does not match configured RAG_QDRANT_VECTOR_SIZE=${this.vectorSize}.`
      );
    }

    const safeLimit = Math.min(Math.max(limit ?? this.maxChunks, 1), this.maxChunks);
    const rawResults = await this.vectorStore.search({
      queryEmbedding: embedding.embedding,
      limit: Math.min(Math.max(safeLimit * this.maxSourcesPerDocument * 2, 1), this.maxChunks * this.maxSourcesPerDocument * 2),
      minScore: this.minScore
    });

    const rankedResults = applyHybridRerank(rawResults, queryAnalysis, this.qualityConfig);
    const collapsedResults = collapseDuplicateSources(rankedResults, {
      limit: safeLimit,
      maxSourcesPerDocument: this.maxSourcesPerDocument
    });

    if (shouldFallbackNoSource(collapsedResults, queryAnalysis, this.qualityConfig)) {
      return [];
    }

    return collapsedResults;
  }
}

export function rankSearchResults(
  results: RagSearchResult[],
  options: { query: string; sourceReliabilityBonus: number; topicMatchBonus: number }
): RagSearchResult[] {
  return applyHybridRerank(results, buildRetrievalQuery(options.query), {
    duplicatePenalty: 0,
    hybridEnabled: true,
    lexicalScoreWeight: 0,
    minSourceCoverage: 1,
    noSourceMinScore: 0,
    sectionMatchBonus: 0,
    sourceReliabilityBonus: options.sourceReliabilityBonus,
    titleMatchBonus: 0,
    topicMatchBonus: options.topicMatchBonus,
    vectorScoreWeight: 1
  });
}

export function dedupeSearchResults(
  results: RagSearchResult[],
  options: { limit: number; maxSourcesPerDocument: number }
): RagSearchResult[] {
  return collapseDuplicateSources(results, options);
}

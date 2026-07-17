import type { EmbeddingProvider } from "@babyloop/ai-core";
import type { RagAnswerOwnerPolicy } from "./rag-answer-owner-registry.js";
import { buildRetrievalQuery } from "./rag-query-normalizer.service.js";
import {
  applyHybridRerank,
  collapseDuplicateSources,
  shouldFallbackNoSource,
  type RagRetrievalQualityConfig
} from "./rag-retrieval-quality.service.js";
import type { RagSearchResult, RagVectorStore } from "./rag.types.js";

export type RagSearchOptions = {
  allowedSafetyScopes?: string[] | undefined;
  allowedSourcePaths?: string[] | undefined;
  allowedTopics?: string[] | undefined;
  candidateLimit?: number | undefined;
  forbiddenSourcePaths?: string[] | undefined;
  forbiddenTopics?: string[] | undefined;
  maxChunksPerDocument?: number | undefined;
  minFinalScore?: number | undefined;
  minScoreMargin?: number | undefined;
  minSourceCoverage?: number | undefined;
  minimumReliability?: string | undefined;
  requireCanonicalOwner?: boolean | undefined;
  requiredOwner?: string | undefined;
};

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

  async search(query: string, limit?: number, options: RagSearchOptions = {}): Promise<RagSearchResult[]> {
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
    const maxChunksPerDocument = options.maxChunksPerDocument ?? this.maxSourcesPerDocument;
    const candidateLimit = options.candidateLimit ?? safeLimit * maxChunksPerDocument * 4;
    const rawResults = await this.vectorStore.search({
      queryEmbedding: embedding.embedding,
      limit: Math.min(Math.max(candidateLimit, 1), this.maxChunks * this.maxSourcesPerDocument * 4),
      minScore: this.minScore,
      filter: buildVectorFilter(options)
    });

    const hardFilteredResults = applyRagSearchPolicy(rawResults, options);
    const rankedResults = applyHybridRerank(hardFilteredResults, queryAnalysis, {
      ...this.qualityConfig,
      minSourceCoverage: options.minSourceCoverage ?? this.qualityConfig.minSourceCoverage,
      noSourceMinScore: options.minFinalScore ?? this.qualityConfig.noSourceMinScore
    });
    const collapsedResults = collapseDuplicateSources(rankedResults, {
      limit: safeLimit,
      maxSourcesPerDocument: maxChunksPerDocument
    });

    if (failsCanonicalOwnerCoverage(collapsedResults, options)) {
      return [];
    }

    if (failsScoreMargin(collapsedResults, options)) {
      return [];
    }

    if (shouldFallbackNoSource(collapsedResults, queryAnalysis, {
      ...this.qualityConfig,
      minSourceCoverage: options.minSourceCoverage ?? this.qualityConfig.minSourceCoverage,
      noSourceMinScore: options.minFinalScore ?? this.qualityConfig.noSourceMinScore
    })) {
      return [];
    }

    return collapsedResults;
  }
}

export function policyFromAnswerOwner(policy: RagAnswerOwnerPolicy): RagSearchOptions {
  return {
    allowedSafetyScopes: policy.allowedSafetyScopes,
    allowedSourcePaths: policy.allowedSourcePaths,
    allowedTopics: policy.allowedTopics,
    forbiddenSourcePaths: policy.forbiddenSourcePaths,
    forbiddenTopics: policy.forbiddenTopics,
    maxChunksPerDocument: 2,
    minFinalScore: policy.requireCanonicalOwner ? 0.78 : 0.68,
    minScoreMargin: policy.requireCanonicalOwner ? 0.02 : 0,
    minSourceCoverage: policy.minimumSourceCount,
    minimumReliability: policy.minimumReliability === "any" ? undefined : policy.minimumReliability,
    requireCanonicalOwner: policy.requireCanonicalOwner,
    ...(policy.owner ? { requiredOwner: policy.owner } : {})
  };
}

export function applyRagSearchPolicy(results: RagSearchResult[], options: RagSearchOptions): RagSearchResult[] {
  return results.filter((result) => getRagSearchPolicyRejectReason(result, options) === null);
}

export function getRagSearchPolicyRejectReason(result: RagSearchResult, options: RagSearchOptions): string | null {
  const citation = result.citation;
  const answerOwner = citation.answerOwner ?? inferAnswerOwnerFromCitation(result);

  if (options.forbiddenTopics?.includes(citation.topic ?? "")) {
    return "forbidden_topic";
  }

  if (options.forbiddenSourcePaths?.includes(citation.sourcePath)) {
    return "forbidden_source_path";
  }

  if (options.allowedTopics && options.allowedTopics.length > 0 && !options.allowedTopics.includes(citation.topic ?? "")) {
    return "topic_not_allowed";
  }

  if (options.allowedSourcePaths && options.allowedSourcePaths.length > 0 && !options.allowedSourcePaths.includes(citation.sourcePath)) {
    return "source_path_not_allowed";
  }

  if (options.minimumReliability && citation.sourceReliability && compareReliability(citation.sourceReliability, options.minimumReliability) < 0) {
    return "source_reliability_too_low";
  }

  if (options.requiredOwner && answerOwner && answerOwner !== options.requiredOwner && options.requireCanonicalOwner) {
    return "owner_mismatch";
  }

  return null;
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

function buildVectorFilter(options: RagSearchOptions) {
  if (
    !options.allowedTopics?.length &&
    !options.allowedSourcePaths?.length &&
    !options.forbiddenTopics?.length &&
    !options.forbiddenSourcePaths?.length &&
    !options.requiredOwner
  ) {
    return undefined;
  }

  return {
    allowedSourcePaths: options.allowedSourcePaths,
    allowedTopics: options.allowedTopics,
    forbiddenSourcePaths: options.forbiddenSourcePaths,
    forbiddenTopics: options.forbiddenTopics,
    requiredOwner: options.requiredOwner
  };
}

function failsCanonicalOwnerCoverage(results: RagSearchResult[], options: RagSearchOptions): boolean {
  if (!options.requireCanonicalOwner || !options.requiredOwner) {
    return false;
  }

  return !results.some((result) => (result.citation.answerOwner ?? inferAnswerOwnerFromCitation(result)) === options.requiredOwner);
}

function failsScoreMargin(results: RagSearchResult[], options: RagSearchOptions): boolean {
  if (!options.minScoreMargin || results.length < 2) {
    return false;
  }

  const [first, second] = results;

  if (!first || !second) {
    return false;
  }

  return first.score - second.score < options.minScoreMargin && (first.citation.topic ?? "") !== (second.citation.topic ?? "");
}

function inferAnswerOwnerFromCitation(result: RagSearchResult): string | null {
  const path = result.citation.sourcePath;

  if (path.endsWith("44-feeding-and-food-safety-canon.md")) {
    return "feeding-and-food-safety-canon";
  }

  if (path.endsWith("46-illness-red-flags-boundary-canon.md")) {
    return "illness-red-flags-boundary-canon";
  }

  if (path.endsWith("45-safe-sleep-and-product-boundary-canon.md")) {
    return "safe-sleep-and-product-boundary-canon";
  }

  if (path.endsWith("47-second-hand-product-safety-canon.md")) {
    return "second-hand-product-safety-canon";
  }

  if (path.endsWith("08-car-seat-second-hand-checklist.md")) {
    return "car-seat-second-hand-checklist";
  }

  if (path.endsWith("01-babyloop-marketplace-guide.md")) {
    return "babyloop-marketplace-guide";
  }

  return result.citation.answerOwner ?? null;
}

function compareReliability(actual: string, minimum: string): number {
  const order = ["internal", "editorial", "internal-policy", "official-source-note", "official-referenced"];
  const actualIndex = order.indexOf(actual);
  const minimumIndex = order.indexOf(minimum);

  if (actualIndex === -1 || minimumIndex === -1) {
    return actual === minimum ? 0 : -1;
  }

  return actualIndex - minimumIndex;
}

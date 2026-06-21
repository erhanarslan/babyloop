import type { EmbeddingProvider } from "@babyloop/ai-core";
import { routeAssistantIntent } from "./assistant-intent-router.service.js";
import type { RagSearchResult, RagVectorStore } from "./rag.types.js";

export type RagSearchServiceOptions = {
  embeddingProvider: EmbeddingProvider;
  maxChunks: number;
  maxSourcesPerDocument: number;
  minScore: number;
  sourceReliabilityBonus?: number;
  topicMatchBonus?: number;
  vectorSize: number;
  vectorStore: RagVectorStore;
};

export class RagSearchService {
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly maxChunks: number;
  private readonly maxSourcesPerDocument: number;
  private readonly minScore: number;
  private readonly sourceReliabilityBonus: number;
  private readonly topicMatchBonus: number;
  private readonly vectorSize: number;
  private readonly vectorStore: RagVectorStore;

  constructor(options: RagSearchServiceOptions) {
    this.embeddingProvider = options.embeddingProvider;
    this.maxChunks = options.maxChunks;
    this.maxSourcesPerDocument = options.maxSourcesPerDocument;
    this.minScore = options.minScore;
    this.sourceReliabilityBonus = options.sourceReliabilityBonus ?? 0;
    this.topicMatchBonus = options.topicMatchBonus ?? 0;
    this.vectorSize = options.vectorSize;
    this.vectorStore = options.vectorStore;
  }

  async search(query: string, limit?: number): Promise<RagSearchResult[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new Error("RAG query cannot be empty.");
    }

    const embedding = await this.embeddingProvider.embedText({
      text: normalizedQuery
    });

    if (embedding.embedding.length !== this.vectorSize) {
      throw new Error(
        `Embedding vector size ${embedding.embedding.length} does not match configured RAG_QDRANT_VECTOR_SIZE=${this.vectorSize}.`
      );
    }

    const rawResults = await this.vectorStore.search({
      queryEmbedding: embedding.embedding,
      limit: Math.min(Math.max((limit ?? this.maxChunks) * this.maxSourcesPerDocument, 1), this.maxChunks * this.maxSourcesPerDocument),
      minScore: this.minScore
    });

    const rankedResults = rankSearchResults(rawResults, {
      query: normalizedQuery,
      sourceReliabilityBonus: this.sourceReliabilityBonus,
      topicMatchBonus: this.topicMatchBonus
    });

    return dedupeSearchResults(rankedResults, {
      limit: Math.min(Math.max(limit ?? this.maxChunks, 1), this.maxChunks),
      maxSourcesPerDocument: this.maxSourcesPerDocument
    });
  }
}

export function rankSearchResults(
  results: RagSearchResult[],
  options: { query: string; sourceReliabilityBonus: number; topicMatchBonus: number }
): RagSearchResult[] {
  const intent = routeAssistantIntent(options.query).intent;
  const expectedTopics = topicsForIntent(intent);

  return results
    .map((result, index) => ({
      index,
      result: {
        ...result,
        score: Math.min(
          1,
          result.score +
            topicBonus(result.citation.topic, expectedTopics, options.topicMatchBonus) +
            reliabilityBonus(result.citation.sourceReliability, options.sourceReliabilityBonus)
        )
      }
    }))
    .sort((left, right) => right.result.score - left.result.score || left.index - right.index)
    .map(({ result }) => result);
}

export function dedupeSearchResults(
  results: RagSearchResult[],
  options: { limit: number; maxSourcesPerDocument: number }
): RagSearchResult[] {
  const sectionKeys = new Set<string>();
  const documentCounts = new Map<string, number>();
  const deduped: RagSearchResult[] = [];

  for (const result of results) {
    const documentKey = result.citation.sourcePath;
    const sectionKey = `${documentKey}:${result.citation.section ?? ""}:${result.citation.topic ?? ""}`;
    const documentCount = documentCounts.get(documentKey) ?? 0;

    if (sectionKeys.has(sectionKey) || documentCount >= options.maxSourcesPerDocument) {
      continue;
    }

    sectionKeys.add(sectionKey);
    documentCounts.set(documentKey, documentCount + 1);
    deduped.push(result);

    if (deduped.length >= options.limit) {
      break;
    }
  }

  return deduped;
}

function topicsForIntent(intent: string): Set<string> {
  if (intent === "listing_help") {
    return new Set(["listing-writing", "seller-photos", "buyer-questions"]);
  }

  if (intent === "babyloop_usage") {
    return new Set(["marketplace-guide", "messaging-privacy", "safe-shopping"]);
  }

  if (intent === "child_needs") {
    return new Set(["age-based-needs", "seasonal-needs"]);
  }

  if (intent === "listing_search") {
    return new Set(["product-buying", "stroller-safety", "car-seat-safety", "toy-safety"]);
  }

  return new Set([
    "safe-shopping",
    "product-buying",
    "stroller-safety",
    "car-seat-safety",
    "toy-safety",
    "textile-hygiene",
    "sleep-product-safety"
  ]);
}

function topicBonus(topic: string | undefined, expectedTopics: Set<string>, bonus: number): number {
  if (!topic || bonus <= 0) {
    return 0;
  }

  return expectedTopics.has(topic) ? bonus : 0;
}

function reliabilityBonus(sourceReliability: string | undefined, bonus: number): number {
  if (!sourceReliability || bonus <= 0) {
    return 0;
  }

  const weights: Record<string, number> = {
    "internal-policy": 1,
    "official-source-note": 0.8,
    internal: 0.6,
    editorial: 0.4
  };

  return (weights[sourceReliability] ?? 0) * bonus;
}

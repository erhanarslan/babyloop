import type { EmbeddingProvider } from "@babyloop/ai-core";
import type { RagSearchResult, RagVectorStore } from "./rag.types.js";

export type RagSearchServiceOptions = {
  embeddingProvider: EmbeddingProvider;
  maxChunks: number;
  maxSourcesPerDocument: number;
  minScore: number;
  vectorSize: number;
  vectorStore: RagVectorStore;
};

export class RagSearchService {
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly maxChunks: number;
  private readonly maxSourcesPerDocument: number;
  private readonly minScore: number;
  private readonly vectorSize: number;
  private readonly vectorStore: RagVectorStore;

  constructor(options: RagSearchServiceOptions) {
    this.embeddingProvider = options.embeddingProvider;
    this.maxChunks = options.maxChunks;
    this.maxSourcesPerDocument = options.maxSourcesPerDocument;
    this.minScore = options.minScore;
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

    return dedupeSearchResults(rawResults, {
      limit: Math.min(Math.max(limit ?? this.maxChunks, 1), this.maxChunks),
      maxSourcesPerDocument: this.maxSourcesPerDocument
    });
  }
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

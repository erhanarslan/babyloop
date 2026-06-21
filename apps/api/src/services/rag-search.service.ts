import type { EmbeddingProvider } from "@babyloop/ai-core";
import type { RagSearchResult, RagVectorStore } from "./rag.types.js";

export type RagSearchServiceOptions = {
  embeddingProvider: EmbeddingProvider;
  maxChunks: number;
  minScore: number;
  vectorSize: number;
  vectorStore: RagVectorStore;
};

export class RagSearchService {
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly maxChunks: number;
  private readonly minScore: number;
  private readonly vectorSize: number;
  private readonly vectorStore: RagVectorStore;

  constructor(options: RagSearchServiceOptions) {
    this.embeddingProvider = options.embeddingProvider;
    this.maxChunks = options.maxChunks;
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

    return this.vectorStore.search({
      queryEmbedding: embedding.embedding,
      limit: Math.min(Math.max(limit ?? this.maxChunks, 1), this.maxChunks),
      minScore: this.minScore
    });
  }
}

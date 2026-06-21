import type {
  RagChunk,
  RagChunkMetadata,
  RagSearchResult,
  RagVectorStore
} from "./rag.types.js";

type FetchLike = typeof fetch;

export type QdrantVectorStoreOptions = {
  apiKey?: string;
  collectionName: string;
  fetch?: FetchLike;
  url: string;
  vectorSize: number;
};

type QdrantSearchPoint = {
  score?: unknown;
  payload?: unknown;
};

export class QdrantVectorStore implements RagVectorStore {
  private readonly apiKey?: string;
  private readonly collectionName: string;
  private readonly fetch: FetchLike;
  private readonly url: string;
  private readonly vectorSize: number;

  constructor(options: QdrantVectorStoreOptions) {
    this.collectionName = options.collectionName;
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.url = options.url.replace(/\/$/, "");
    this.vectorSize = options.vectorSize;

    if (options.apiKey) {
      this.apiKey = options.apiKey;
    }
  }

  async ensureCollection(): Promise<void> {
    const existing = await this.request(`/collections/${encodeURIComponent(this.collectionName)}`, {
      method: "GET"
    });

    if (existing.ok) {
      return;
    }

    if (existing.status !== 404) {
      throw new Error(`Qdrant collection check failed with status ${existing.status}.`);
    }

    const created = await this.request(`/collections/${encodeURIComponent(this.collectionName)}`, {
      method: "PUT",
      body: JSON.stringify({
        vectors: {
          size: this.vectorSize,
          distance: "Cosine"
        }
      })
    });

    if (!created.ok) {
      throw new Error(`Qdrant collection create failed with status ${created.status}.`);
    }
  }

  async upsertChunks(chunks: Array<RagChunk & { embedding: number[] }>): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const invalid = chunks.find((chunk) => chunk.embedding.length !== this.vectorSize);

    if (invalid) {
      throw new Error(
        `Embedding vector size ${invalid.embedding.length} does not match configured RAG_QDRANT_VECTOR_SIZE=${this.vectorSize}.`
      );
    }

    const response = await this.request(
      `/collections/${encodeURIComponent(this.collectionName)}/points?wait=true`,
      {
        method: "PUT",
        body: JSON.stringify({
          points: chunks.map((chunk) => ({
            id: chunk.id,
            vector: chunk.embedding,
            payload: {
              text: chunk.text,
              ...chunk.metadata
            }
          }))
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Qdrant upsert failed with status ${response.status}.`);
    }
  }

  async search(options: {
    queryEmbedding: number[];
    limit: number;
    minScore: number;
  }): Promise<RagSearchResult[]> {
    if (options.queryEmbedding.length !== this.vectorSize) {
      throw new Error(
        `Query vector size ${options.queryEmbedding.length} does not match configured RAG_QDRANT_VECTOR_SIZE=${this.vectorSize}.`
      );
    }

    const response = await this.request(
      `/collections/${encodeURIComponent(this.collectionName)}/points/search`,
      {
        method: "POST",
        body: JSON.stringify({
          vector: options.queryEmbedding,
          limit: options.limit,
          score_threshold: options.minScore,
          with_payload: true
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Qdrant search failed with status ${response.status}.`);
    }

    const payload = await response.json() as { result?: unknown };
    const result = Array.isArray(payload.result) ? payload.result : [];

    return result.flatMap((point) => toSearchResult(point));
  }

  private request(path: string, init: { body?: string; method: "GET" | "POST" | "PUT" }): Promise<Response> {
    return this.fetch(`${this.url}${path}`, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { "api-key": this.apiKey } : {})
      },
      ...(init.body ? { body: init.body } : {})
    });
  }
}

function toSearchResult(point: unknown): RagSearchResult[] {
  if (typeof point !== "object" || point === null) {
    return [];
  }

  const qdrantPoint = point as QdrantSearchPoint;
  const score = typeof qdrantPoint.score === "number" ? qdrantPoint.score : null;
  const payload = qdrantPoint.payload;

  if (score === null || typeof payload !== "object" || payload === null) {
    return [];
  }

  const metadata = payload as Partial<RagChunkMetadata> & { text?: unknown };
  const text = typeof metadata.text === "string" ? metadata.text : "";

  if (!text || !metadata.title || !metadata.sourcePath) {
    return [];
  }

  return [
    {
      score,
      text,
      citation: {
        title: metadata.title,
        sourcePath: metadata.sourcePath,
        ...(metadata.section ? { section: metadata.section } : {}),
        ...(metadata.topic ? { topic: metadata.topic } : {})
      }
    }
  ];
}

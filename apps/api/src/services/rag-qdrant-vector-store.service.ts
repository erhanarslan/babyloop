import type {
  RagChunk,
  RagChunkMetadata,
  RagCollectionInfo,
  RagIndexedDocumentSnapshot,
  RagVectorSearchFilter,
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

type QdrantScrollPoint = {
  payload?: unknown;
};

export type QdrantAliasSummary = {
  aliasName: string;
  collectionName: string;
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

  async collectionExists(collectionName: string): Promise<boolean> {
    const response = await this.request(`/collections/${encodeURIComponent(collectionName)}`, {
      method: "GET"
    });

    if (response.ok) {
      return true;
    }

    if (response.status === 404) {
      return false;
    }

    throw new Error(`Qdrant collection existence check failed with status ${response.status}.`);
  }

  async createNamedCollection(collectionName: string): Promise<void> {
    const created = await this.request(`/collections/${encodeURIComponent(collectionName)}`, {
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

  async listCollections(): Promise<string[]> {
    const response = await this.request("/collections", {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error(`Qdrant collection list failed with status ${response.status}.`);
    }

    const payload = await response.json() as { result?: unknown };
    const result = typeof payload.result === "object" && payload.result !== null
      ? payload.result as Record<string, unknown>
      : {};
    const collections = Array.isArray(result.collections) ? result.collections : [];

    return collections.flatMap((collection) => {
      if (typeof collection !== "object" || collection === null) {
        return [];
      }

      const name = (collection as Record<string, unknown>).name;
      return typeof name === "string" ? [name] : [];
    });
  }

  async listAliases(): Promise<QdrantAliasSummary[]> {
    const response = await this.request("/aliases", {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error(`Qdrant alias list failed with status ${response.status}.`);
    }

    const payload = await response.json() as { result?: unknown };
    const result = typeof payload.result === "object" && payload.result !== null
      ? payload.result as Record<string, unknown>
      : {};
    const aliases = Array.isArray(result.aliases) ? result.aliases : [];

    return aliases.flatMap((alias) => {
      if (typeof alias !== "object" || alias === null) {
        return [];
      }

      const record = alias as Record<string, unknown>;
      const aliasName = typeof record.alias_name === "string" ? record.alias_name : null;
      const collectionName = typeof record.collection_name === "string" ? record.collection_name : null;

      return aliasName && collectionName ? [{ aliasName, collectionName }] : [];
    });
  }

  async getAliasTarget(aliasName: string): Promise<string | null> {
    const aliases = await this.listAliases();
    return aliases.find((alias) => alias.aliasName === aliasName)?.collectionName ?? null;
  }

  async switchAliasAtomically(aliasName: string, targetCollection: string): Promise<void> {
    const currentTarget = await this.getAliasTarget(aliasName);
    const actions: Array<Record<string, unknown>> = [];

    if (currentTarget) {
      actions.push({
        delete_alias: {
          alias_name: aliasName
        }
      });
    }

    actions.push({
      create_alias: {
        alias_name: aliasName,
        collection_name: targetCollection
      }
    });

    const response = await this.request("/collections/aliases", {
      method: "POST",
      body: JSON.stringify({ actions })
    });

    if (!response.ok) {
      throw new Error(`Qdrant alias switch failed with status ${response.status}.`);
    }
  }

  async deleteAlias(aliasName: string): Promise<void> {
    const response = await this.request("/collections/aliases", {
      method: "POST",
      body: JSON.stringify({
        actions: [
          {
            delete_alias: {
              alias_name: aliasName
            }
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Qdrant alias delete failed with status ${response.status}.`);
    }
  }

  async countNamedCollectionPoints(collectionName: string): Promise<number> {
    return (await this.getNamedCollectionInfo(collectionName)).pointsCount;
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
              documentId: chunk.metadata.documentId,
              documentTitle: chunk.metadata.documentTitle ?? chunk.metadata.title,
              title: chunk.metadata.title,
              sourcePath: chunk.metadata.sourcePath,
              section: chunk.metadata.section,
              topic: chunk.metadata.topic,
              safetyScope: chunk.metadata.safetyScope,
              sourceReliability: chunk.metadata.sourceReliability,
              answerOwner: chunk.metadata.answerOwner ?? chunk.metadata.id,
              allowedDomains: chunk.metadata.allowedDomains,
              forbiddenDomains: chunk.metadata.forbiddenDomains,
              questionFamilies: chunk.metadata.questionFamilies,
              ageBands: chunk.metadata.ageBands,
              sectionKind: chunk.metadata.sectionKind,
              riskLevel: chunk.metadata.riskLevel,
              version: chunk.metadata.version,
              checksum: chunk.metadata.checksum,
              checksumShort: chunk.metadata.checksumShort,
              chunkId: chunk.metadata.chunkId ?? chunk.id,
              chunkIndex: chunk.metadata.chunkIndex,
              indexVersion: chunk.metadata.indexVersion,
              embeddingModel: chunk.metadata.embeddingModel,
              indexedAt: chunk.metadata.indexedAt,
              contentLength: chunk.metadata.contentLength ?? chunk.text.length,
              locale: chunk.metadata.locale
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
    filter?: RagVectorSearchFilter;
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
          with_payload: true,
          ...(options.filter ? { filter: toQdrantFilter(options.filter) } : {})
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

  async getIndexedDocumentSnapshots(documentIds: string[]): Promise<Map<string, RagIndexedDocumentSnapshot>> {
    const snapshots = new Map<string, RagIndexedDocumentSnapshot>();

    for (const documentId of documentIds) {
      const points = await this.scrollDocumentPoints(documentId);
      snapshots.set(documentId, buildSnapshot(points));
    }

    return snapshots;
  }

  async getCollectionInfo(): Promise<RagCollectionInfo> {
    return this.getNamedCollectionInfo(this.collectionName);
  }

  async getNamedCollectionInfo(collectionName: string): Promise<RagCollectionInfo> {
    const response = await this.request(`/collections/${encodeURIComponent(collectionName)}`, {
      method: "GET"
    });

    if (!response.ok) {
      return {
        status: "unknown",
        pointsCount: 0,
        vectorSize: this.vectorSize,
        indexedVectorsCount: 0
      };
    }

    const payload = await response.json() as { result?: unknown };
    const result = typeof payload.result === "object" && payload.result !== null
      ? payload.result as Record<string, unknown>
      : {};
    const config = typeof result.config === "object" && result.config !== null
      ? result.config as Record<string, unknown>
      : {};
    const params = typeof config.params === "object" && config.params !== null
      ? config.params as Record<string, unknown>
      : {};
    const vectors = typeof params.vectors === "object" && params.vectors !== null
      ? params.vectors as Record<string, unknown>
      : {};
    const status = typeof result.status === "string" && ["green", "yellow", "red"].includes(result.status)
      ? result.status as RagCollectionInfo["status"]
      : "unknown";

    return {
      status,
      pointsCount: numberOrZero(result.points_count),
      vectorSize: numberOrDefault(vectors.size, this.vectorSize),
      indexedVectorsCount: numberOrZero(result.indexed_vectors_count)
    };
  }

  async scrollNamedCollectionPayloads(collectionName: string, options: { limit?: number } = {}): Promise<Array<Record<string, unknown>>> {
    const payloads: Array<Record<string, unknown>> = [];
    let offset: unknown = null;
    const limit = Math.min(Math.max(options.limit ?? 256, 1), 256);

    do {
      const response = await this.request(
        `/collections/${encodeURIComponent(collectionName)}/points/scroll`,
        {
          method: "POST",
          body: JSON.stringify({
            limit,
            with_payload: true,
            with_vector: false,
            ...(offset ? { offset } : {})
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Qdrant collection scroll failed with status ${response.status}.`);
      }

      const payload = await response.json() as { result?: unknown };
      const result = typeof payload.result === "object" && payload.result !== null
        ? payload.result as Record<string, unknown>
        : {};
      const batch = Array.isArray(result.points) ? result.points : [];

      for (const point of batch) {
        if (typeof point !== "object" || point === null) {
          continue;
        }

        const pointPayload = (point as QdrantScrollPoint).payload;
        if (typeof pointPayload === "object" && pointPayload !== null) {
          payloads.push(pointPayload as Record<string, unknown>);
        }
      }

      offset = result.next_page_offset ?? null;
    } while (offset);

    return payloads;
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

  private async scrollDocumentPoints(documentId: string): Promise<QdrantScrollPoint[]> {
    const points: QdrantScrollPoint[] = [];
    let offset: unknown = null;

    do {
      const response = await this.request(
        `/collections/${encodeURIComponent(this.collectionName)}/points/scroll`,
        {
          method: "POST",
          body: JSON.stringify({
            limit: 256,
            with_payload: true,
            with_vector: false,
            filter: {
              must: [
                {
                  key: "documentId",
                  match: {
                    value: documentId
                  }
                }
              ]
            },
            ...(offset ? { offset } : {})
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Qdrant document scroll failed with status ${response.status}.`);
      }

      const payload = await response.json() as { result?: unknown };
      const result = typeof payload.result === "object" && payload.result !== null
        ? payload.result as Record<string, unknown>
        : {};
      const batch = Array.isArray(result.points) ? result.points : [];
      points.push(...batch.flatMap((point) => typeof point === "object" && point !== null ? [point as QdrantScrollPoint] : []));
      offset = result.next_page_offset ?? null;
    } while (offset);

    return points;
  }
}

function buildSnapshot(points: QdrantScrollPoint[]): RagIndexedDocumentSnapshot {
  const payloads = points
    .map((point) => point.payload)
    .filter((payload): payload is Record<string, unknown> => typeof payload === "object" && payload !== null);
  const checksums = uniqueStrings(payloads.map((payload) => payload.checksum));
  const checksumShorts = uniqueStrings(payloads.map((payload) => payload.checksumShort));
  const versions = uniqueStrings(payloads.map((payload) => payload.version));
  const indexedAts = uniqueStrings(payloads.map((payload) => payload.indexedAt)).sort();

  return {
    chunkCount: points.length,
    checksum: checksums.length === 1 ? checksums[0] ?? null : null,
    checksumShort: checksumShorts.length === 1 ? checksumShorts[0] ?? null : null,
    indexedAt: indexedAts.at(-1) ?? null,
    version: versions.length === 1 ? versions[0] ?? null : null
  };
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
        ...(metadata.topic ? { topic: metadata.topic } : {}),
        ...(metadata.sourceReliability ? { sourceReliability: metadata.sourceReliability } : {}),
        ...(metadata.answerOwner ? { answerOwner: metadata.answerOwner } : {}),
        ...(metadata.sectionKind ? { sectionKind: metadata.sectionKind } : {})
      }
    }
  ];
}

function toQdrantFilter(filter: RagVectorSearchFilter): Record<string, unknown> {
  const must: Array<Record<string, unknown>> = [];
  const mustNot: Array<Record<string, unknown>> = [];

  addAnyMatch(must, "topic", filter.allowedTopics);
  addAnyMatch(must, "sourcePath", filter.allowedSourcePaths);

  if (filter.requiredOwner) {
    must.push({
      key: "answerOwner",
      match: {
        value: filter.requiredOwner
      }
    });
  }

  addAnyMatch(mustNot, "topic", filter.forbiddenTopics);
  addAnyMatch(mustNot, "sourcePath", filter.forbiddenSourcePaths);

  return {
    ...(must.length > 0 ? { must } : {}),
    ...(mustNot.length > 0 ? { must_not: mustNot } : {})
  };
}

function addAnyMatch(target: Array<Record<string, unknown>>, key: string, values: string[] | undefined): void {
  if (!values || values.length === 0) {
    return;
  }

  target.push({
    should: values.map((value) => ({
      key,
      match: {
        value
      }
    }))
  });
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))];
}

import { describe, expect, it, vi } from "vitest";
import {
  QdrantVectorStore,
  RAG_QDRANT_FILTER_PAYLOAD_INDEXES
} from "../src/services/rag-qdrant-vector-store.service.js";
import { validateCandidateCollection } from "../src/services/rag-index-deployment.service.js";

describe("Qdrant RAG filter payload indexes", () => {
  it("creates all required keyword indexes with authenticated wait=true requests", async () => {
    const requests: Array<{
      body: unknown;
      headers: Headers;
      method: string;
      url: string;
    }> = [];

    const fetchMock = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      requests.push({
        body: init?.body ? JSON.parse(String(init.body)) : null,
        headers: new Headers(init?.headers),
        method: init?.method ?? "GET",
        url: String(input)
      });

      return new Response(
        JSON.stringify({
          result: {
            operation_id: 1,
            status: "completed"
          },
          status: "ok"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }) as unknown as typeof fetch;

    const store = new QdrantVectorStore({
      apiKey: "qdrant-test-key",
      collectionName: "babyloop_rag_vtest",
      fetch: fetchMock,
      url: "https://qdrant.example.test",
      vectorSize: 3072
    });

    await store.ensureSearchPayloadIndexes();

    expect(requests).toHaveLength(3);
    expect(requests.map((request) => request.url)).toEqual(
      RAG_QDRANT_FILTER_PAYLOAD_INDEXES.map(
        () => "https://qdrant.example.test/collections/babyloop_rag_vtest/index?wait=true"
      )
    );
    expect(requests.map((request) => request.method)).toEqual([
      "PUT",
      "PUT",
      "PUT"
    ]);
    expect(requests.map((request) => request.body)).toEqual(
      RAG_QDRANT_FILTER_PAYLOAD_INDEXES.map((fieldName) => ({
        field_name: fieldName,
        field_schema: "keyword"
      }))
    );
    expect(
      requests.every(
        (request) => request.headers.get("api-key") === "qdrant-test-key"
      )
    ).toBe(true);
  });

  it("reads collection payload schema without exposing vectors", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        result: {
          payload_schema: {
            answerOwner: {
              data_type: "keyword",
              points: 295
            },
            sourcePath: {
              data_type: "keyword",
              points: 295
            },
            topic: {
              data_type: "keyword",
              points: 295
            }
          }
        },
        status: "ok"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    )) as unknown as typeof fetch;

    const store = new QdrantVectorStore({
      collectionName: "babyloop_rag_vtest",
      fetch: fetchMock,
      url: "https://qdrant.example.test",
      vectorSize: 3072
    });

    await expect(
      store.getNamedCollectionPayloadSchema("babyloop_rag_vtest")
    ).resolves.toMatchObject({
      answerOwner: {
        data_type: "keyword"
      },
      sourcePath: {
        data_type: "keyword"
      },
      topic: {
        data_type: "keyword"
      }
    });
  });

  it("fails candidate validation when a required keyword index is missing", async () => {
    const vectorStore = createValidationStore({
      answerOwner: {
        data_type: "keyword"
      },
      sourcePath: {
        data_type: "keyword"
      }
    });

    const summary = await validateCandidateCollection({
      collectionName: "babyloop_rag_vtest",
      expectedChunkCount: 1,
      expectedEmbeddingModel: "gemini-embedding-2",
      expectedVectorSize: 3072,
      vectorStore
    });

    expect(summary.passed).toBe(false);
    expect(summary.errors).toContain(
      "keyword payload index topic is missing"
    );
  });

  it("passes candidate validation when all required keyword indexes exist", async () => {
    const vectorStore = createValidationStore({
      answerOwner: {
        data_type: "keyword"
      },
      sourcePath: {
        data_type: "keyword"
      },
      topic: {
        data_type: "keyword"
      }
    });

    const summary = await validateCandidateCollection({
      collectionName: "babyloop_rag_vtest",
      expectedChunkCount: 1,
      expectedEmbeddingModel: "gemini-embedding-2",
      expectedVectorSize: 3072,
      vectorStore
    });

    expect(summary.passed).toBe(true);
    expect(summary.errors).toEqual([]);
  });
});

function createValidationStore(
  payloadSchema: Record<string, unknown>
): QdrantVectorStore {
  const payload = {
    answerOwner: "feeding-and-food-safety-canon",
    checksum: "checksum",
    chunkId: "chunk-1",
    chunkIndex: 0,
    documentId: "feeding-doc",
    embeddingModel: "gemini-embedding-2",
    indexVersion: "babyloop_rag_vtest",
    sourcePath: "docs/rag/44-feeding-and-food-safety-canon.md",
    sourceReliability: "official-referenced",
    topic: "feeding-food-safety",
    version: "1"
  };

  return {
    async collectionExists() {
      return true;
    },
    async getNamedCollectionInfo() {
      return {
        indexedVectorsCount: 1,
        pointsCount: 1,
        status: "green" as const,
        vectorSize: 3072
      };
    },
    async getNamedCollectionPayloadSchema() {
      return payloadSchema;
    },
    async scrollNamedCollectionPayloads() {
      return [payload];
    }
  } as unknown as QdrantVectorStore;
}

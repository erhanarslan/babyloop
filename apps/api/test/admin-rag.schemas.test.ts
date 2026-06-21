import { describe, expect, it } from "vitest";
import {
  adminRagEvalRunBodySchema,
  adminRagHealthSchema,
  adminRagSourceReliabilitySchema
} from "../src/schemas/admin-rag.schemas.js";

describe("admin rag schemas", () => {
  it("accepts source reliability values", () => {
    expect(adminRagSourceReliabilitySchema.parse("internal-policy")).toBe("internal-policy");
    expect(adminRagSourceReliabilitySchema.parse("official-source-note")).toBe("official-source-note");
  });

  it("defaults eval run mode and limit safely", () => {
    expect(adminRagEvalRunBodySchema.parse({})).toEqual({
      mode: "mock",
      limit: 20
    });
  });

  it("validates health summary shape", () => {
    const parsed = adminRagHealthSchema.parse({
      enabled: true,
      vectorStore: "qdrant",
      collection: "babyloop_rag",
      qdrant: {
        status: "green",
        pointsCount: 1,
        vectorSize: 3072,
        indexedVectorsCount: 1
      },
      docs: {
        documentCount: 1,
        chunkCountEstimate: 2,
        topics: ["safe-shopping"],
        sourceReliabilityCounts: {
          internal: 1
        }
      },
      config: {
        embeddingProvider: "gemini",
        embeddingModel: "gemini-embedding-001",
        chatProvider: "gemini",
        chatModel: "gemini-2.5-flash",
        minScore: 0.72,
        maxChunks: 5,
        maxSourcesPerDocument: 2,
        cacheEnabled: true,
        liveEvalEnabled: false
      }
    });

    expect(parsed.qdrant.vectorSize).toBe(3072);
  });
});

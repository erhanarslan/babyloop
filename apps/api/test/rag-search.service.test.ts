import { describe, expect, it } from "vitest";
import type { EmbeddingProvider } from "@babyloop/ai-core";
import {
  dedupeSearchResults,
  RagSearchService,
  rankSearchResults
} from "../src/services/rag-search.service.js";
import type { RagVectorStore } from "../src/services/rag.types.js";

const embeddingProvider: EmbeddingProvider = {
  providerName: "mock-embedding",
  async embedText() {
    return {
      embedding: [0.1, 0.2, 0.3],
      providerName: "mock-embedding",
      promptVersion: "test"
    };
  }
};

describe("rag search service", () => {
  it("returns no sources when vector store returns below threshold results", async () => {
    const vectorStore: RagVectorStore = {
      async ensureCollection() {},
      async upsertChunks() {},
      async search() {
        return [];
      }
    };
    const service = new RagSearchService({
      embeddingProvider,
      maxChunks: 5,
      maxSourcesPerDocument: 2,
      minScore: 0.72,
      vectorSize: 3,
      vectorStore
    });

    await expect(service.search("ilgili kaynak var mı")).resolves.toEqual([]);
  });

  it("returns citations when vector store has matching results", async () => {
    const vectorStore: RagVectorStore = {
      async ensureCollection() {},
      async upsertChunks() {},
      async search() {
        return [
          {
            score: 0.9,
            text: "Bebek arabasında fren ve tekerlek kontrol edilir.",
            citation: {
              title: "Ürün seçimi kontrol rehberleri",
              sourcePath: "docs/rag/04-product-buying-guides.md",
              section: "Bebek arabası",
              topic: "product-buying"
            }
          }
        ];
      }
    };
    const service = new RagSearchService({
      embeddingProvider,
      maxChunks: 5,
      maxSourcesPerDocument: 2,
      minScore: 0.72,
      vectorSize: 3,
      vectorStore
    });

    const results = await service.search("bebek arabası");

    expect(results).toHaveLength(1);
    expect(results[0]?.citation.title).toBe("Ürün seçimi kontrol rehberleri");
  });

  it("deduplicates repeated sections and caps sources per document", () => {
    const results = dedupeSearchResults(
      [
        createResult("docs/rag/a.md", "Fren", 0.95),
        createResult("docs/rag/a.md", "Fren", 0.94),
        createResult("docs/rag/a.md", "Tekerlek", 0.93),
        createResult("docs/rag/a.md", "Kumaş", 0.92),
        createResult("docs/rag/b.md", "Genel", 0.91)
      ],
      {
        limit: 5,
        maxSourcesPerDocument: 2
      }
    );

    expect(results.map((result) => `${result.citation.sourcePath}:${result.citation.section}`)).toEqual([
      "docs/rag/a.md:Fren",
      "docs/rag/a.md:Tekerlek",
      "docs/rag/b.md:Genel"
    ]);
  });

  it("applies topic and source reliability bonuses before dedupe", () => {
    const ranked = rankSearchResults(
      [
        {
          score: 0.9,
          text: "Genel metin",
          citation: {
            title: "Genel",
            sourcePath: "docs/rag/general.md",
            section: "Genel",
            topic: "general",
            sourceReliability: "editorial"
          }
        },
        {
          score: 0.88,
          text: "Oto koltuğu metni",
          citation: {
            title: "Oto koltuğu",
            sourcePath: "docs/rag/car-seat.md",
            section: "Genel",
            topic: "car-seat-safety",
            sourceReliability: "official-source-note"
          }
        }
      ],
      {
        query: "oto koltuğu ikinci el alınır mı",
        sourceReliabilityBonus: 0.02,
        topicMatchBonus: 0.03
      }
    );

    expect(ranked[0]?.citation.topic).toBe("car-seat-safety");
  });
});

function createResult(sourcePath: string, section: string, score: number) {
  return {
    score,
    text: `${section} kaynak metni.`,
    citation: {
      title: "Test kaynak",
      sourcePath,
      section,
      topic: "test"
    }
  };
}

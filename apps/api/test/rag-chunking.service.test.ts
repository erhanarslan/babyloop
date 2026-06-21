import { describe, expect, it } from "vitest";
import { chunkRagDocument, createDeterministicChunkId } from "../src/services/rag-chunking.service.js";
import type { RagDocument } from "../src/services/rag.types.js";

const document: RagDocument = {
  metadata: {
    id: "test-doc",
    title: "Test Doküman",
    locale: "tr",
    topic: "safe-shopping",
    safetyScope: "marketplace-guidance",
    version: "2026-06-18",
    sourcePath: "docs/rag/test.md"
  },
  content: [
    "# İlk bölüm",
    "",
    "Bebek arabası alırken fren, tekerlek ve kumaş durumu kontrol edilir. ".repeat(8),
    "",
    "## İkinci bölüm",
    "",
    "Oto koltuğu için kaza geçmişi, üretim yılı ve eksik parça bilgisi sorulur. ".repeat(8)
  ].join("\n")
};

describe("rag chunking", () => {
  it("extracts section metadata from markdown headings", () => {
    const chunks = chunkRagDocument(document, {
      targetChars: 420,
      overlapChars: 60
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((chunk) => chunk.metadata.section === "İlk bölüm")).toBe(true);
    expect(chunks.some((chunk) => chunk.metadata.section === "İkinci bölüm")).toBe(true);
  });

  it("does not produce empty chunks", () => {
    const chunks = chunkRagDocument(document);

    expect(chunks.every((chunk) => chunk.text.trim().length > 0)).toBe(true);
  });

  it("creates deterministic chunk ids", () => {
    expect(createDeterministicChunkId("doc", "v1", 0)).toBe(createDeterministicChunkId("doc", "v1", 0));
    expect(createDeterministicChunkId("doc", "v1", 0)).not.toBe(createDeterministicChunkId("doc", "v1", 1));
  });
});

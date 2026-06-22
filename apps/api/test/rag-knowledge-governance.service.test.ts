import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checksumRagDocument,
  RagKnowledgeGovernanceService
} from "../src/services/rag-knowledge-governance.service.js";
import type { RagDocument, RagIndexedDocumentSnapshot } from "../src/services/rag.types.js";

const validDoc = `---
id: stroller-guide
title: Bebek arabası rehberi
locale: tr
topic: stroller-safety
safetyScope: marketplace-guidance
sourceReliability: editorial
version: 2026-06-18
---

# Bebek arabası kontrolü

Bebek arabası alırken fren, tekerlek, katlanma mekanizması ve kumaş durumu birlikte kontrol edilir. İkinci el ürünlerde kesin güvenlik garantisi verilmez; ürünün görünür hasarı, eksik parçası ve kullanım geçmişi sorulmalıdır.
`;

describe("rag knowledge governance service", () => {
  it("summarizes metadata, checksum and indexed status", async () => {
    const docsRoot = await createDocsRoot({
      "01-stroller.md": validDoc
    });
    const checksum = checksumRagDocument(createValidRagDocument());
    const service = new RagKnowledgeGovernanceService({
      docsRoot,
      textPreviewChars: 80,
      vectorStore: {
        async getIndexedDocumentSnapshots(): Promise<Map<string, RagIndexedDocumentSnapshot>> {
          return new Map([
            ["stroller-guide", {
              chunkCount: 1,
              checksum,
              checksumShort: checksum.slice(0, 12),
              indexedAt: "2026-06-22T10:00:00.000Z",
              version: "2026-06-18"
            }]
          ]);
        }
      }
    });

    const [document] = await service.listDocuments();

    expect(document).toMatchObject({
      id: "stroller-guide",
      checksumShort: checksum.slice(0, 12),
      hasRequiredMetadata: true,
      indexingStatus: "indexed",
      reindexRequired: false,
      lastIndexedAt: "2026-06-22T10:00:00.000Z"
    });
  });

  it("reports missing metadata and unknown index status without crashing", async () => {
    const docsRoot = await createDocsRoot({
      "broken.md": `---
id: broken-guide
title: Eksik rehber
locale: tr
topic: safe-shopping
version: 2026-06-18
---

# Eksik metadata

Bu doküman governance testinde eksik frontmatter alanlarını göstermek için kullanılır.`
    });
    const service = new RagKnowledgeGovernanceService({
      docsRoot,
      textPreviewChars: 80,
      vectorStore: {
        async getIndexedDocumentSnapshots() {
          throw new Error("Qdrant unavailable");
        }
      }
    });

    const [document] = await service.listDocuments();

    expect(document?.hasRequiredMetadata).toBe(false);
    expect(document?.missingMetadataFields).toEqual(expect.arrayContaining(["safetyScope", "sourceReliability"]));
    expect(document?.indexingStatus).toBe("unknown");
    expect(document?.reindexRequired).toBe(true);
  });

  it("marks old indexed payloads without checksum metadata as stale", async () => {
    const docsRoot = await createDocsRoot({
      "01-stroller.md": validDoc
    });
    const service = new RagKnowledgeGovernanceService({
      docsRoot,
      textPreviewChars: 80,
      vectorStore: {
        async getIndexedDocumentSnapshots(): Promise<Map<string, RagIndexedDocumentSnapshot>> {
          return new Map([
            ["stroller-guide", {
              chunkCount: 1,
              checksum: null,
              checksumShort: null,
              indexedAt: null,
              version: "2026-06-18"
            }]
          ]);
        }
      }
    });

    const [document] = await service.listDocuments();

    expect(document?.indexingStatus).toBe("stale");
    expect(document?.reindexRequired).toBe(true);
  });

  it("returns chunk previews without vectors or full payload", async () => {
    const docsRoot = await createDocsRoot({
      "01-stroller.md": validDoc
    });
    const service = new RagKnowledgeGovernanceService({
      docsRoot,
      textPreviewChars: 60
    });

    const preview = await service.getChunkPreview("stroller-guide");

    expect(preview?.document.id).toBe("stroller-guide");
    expect(preview?.chunks[0]?.textPreview.length).toBeLessThanOrEqual(61);
    expect(JSON.stringify(preview)).not.toContain("embedding");
    expect(JSON.stringify(preview)).not.toContain("vector");
  });
});

async function createDocsRoot(files: Record<string, string>): Promise<string> {
  const docsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "babyloop-rag-governance-"));

  for (const [filename, content] of Object.entries(files)) {
    await fs.writeFile(path.join(docsRoot, filename), content, "utf8");
  }

  return docsRoot;
}

function createValidRagDocument(): RagDocument {
  return {
    metadata: {
      id: "stroller-guide",
      title: "Bebek arabası rehberi",
      locale: "tr",
      topic: "stroller-safety",
      safetyScope: "marketplace-guidance",
      sourceReliability: "editorial",
      version: "2026-06-18",
      sourcePath: "docs/rag/01-stroller.md"
    },
    content: "# Bebek arabası kontrolü\n\nBebek arabası alırken fren, tekerlek, katlanma mekanizması ve kumaş durumu birlikte kontrol edilir. İkinci el ürünlerde kesin güvenlik garantisi verilmez; ürünün görünür hasarı, eksik parçası ve kullanım geçmişi sorulmalıdır."
  };
}

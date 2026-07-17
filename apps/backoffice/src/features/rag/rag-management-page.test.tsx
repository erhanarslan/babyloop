import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/features/rag/rag-management-page.tsx"),
  "utf8"
);

describe("RagManagementPage", () => {
  it("keeps the operational page split into navigable sections", () => {
    expect(source).toContain("aria-label=\"RAG bölümleri\"");
    expect(source).toContain("#rag-overview");
    expect(source).toContain("#rag-retrieval");
    expect(source).toContain("#rag-documents");
    expect(source).toContain("#rag-cache-limits");
    expect(source).toContain("#rag-index");
    expect(source).toContain("#rag-technical");
  });
});

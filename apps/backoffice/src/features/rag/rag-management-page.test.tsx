import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RagManagementPage } from "./rag-management-page";

vi.mock("./api", () => ({
  getAdminRagHealth: vi.fn(async () => ({
    ok: false,
    error: {
      code: "RAG_HEALTH_UNAVAILABLE",
      message: "Internal server error"
    }
  })),
  listAdminRagDocuments: vi.fn(async () => ({
    ok: true,
    data: { documents: [] }
  })),
  getAdminRagCacheStats: vi.fn(async () => ({
    ok: true,
    data: {
      cache: {
        entries: 0,
        hits: 0,
        misses: 0,
        sets: 0,
        clears: 0,
        hitRate: 0,
        backend: "disabled",
        backendEffective: "disabled"
      }
    }
  })),
  listAdminRagEvalCases: vi.fn(async () => ({
    ok: true,
    data: { cases: [] }
  })),
  getAdminRagMetrics: vi.fn(async () => ({
    ok: true,
    data: {
      metrics: {
        date: "2026-08-01",
        backend: "disabled",
        backendEffective: "disabled",
        counters: {}
      }
    }
  })),
  getAdminRagUsage: vi.fn(async () => ({
    ok: true,
    data: {
      usage: {
        enabled: false,
        backend: "disabled",
        backendEffective: "disabled",
        limits: {
          hourlyGuest: 0,
          dailyGuest: 0,
          hourlyUser: 0,
          dailyUser: 0,
          adminBypass: false
        }
      }
    }
  })),
  getAdminRagReindexCheck: vi.fn(async () => ({
    ok: true,
    data: {
      totalDocuments: 0,
      reindexRequired: 0,
      stale: 0,
      missing: 0,
      unknown: 0,
      documents: []
    }
  })),
  getAdminRagEvalHistory: vi.fn(async () => ({
    ok: true,
    data: { runs: [] }
  })),
  getAdminRagDocumentChunks: vi.fn(),
  getAdminRagEvalHistoryDetail: vi.fn(),
  clearAdminRagCache: vi.fn(),
  runAdminRagEval: vi.fn(),
  runAdminRagPlaygroundQuery: vi.fn(),
  runAdminRagReindex: vi.fn()
}));

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

  it("isolates health failure and keeps the playground and other panels visible", async () => {
    render(<RagManagementPage />);
    expect(await screen.findByText("RAG durumu alınamadı")).toBeInTheDocument();
    expect(screen.getByText("Güvenli hata kodu: RAG_HEALTH_UNAVAILABLE")).toBeInTheDocument();
    expect(screen.queryByText("Internal server error")).not.toBeInTheDocument();
    expect(screen.getByText("RAG Deneme Alanı")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dokümanlar" })).toBeInTheDocument();
  });
});

import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type RagHealth = {
  enabled: boolean;
  vectorStore: "qdrant" | "disabled";
  collection: string | null;
  qdrant: {
    status: "green" | "yellow" | "red" | "unknown";
    pointsCount: number;
    vectorSize: number;
    indexedVectorsCount: number;
  };
  docs: {
    documentCount: number;
    chunkCountEstimate: number;
    topics: string[];
    sourceReliabilityCounts: Record<string, number>;
  };
  config: {
    embeddingProvider: string;
    embeddingModel: string;
    chatProvider: string;
    chatModel: string;
    minScore: number;
    maxChunks: number;
    maxSourcesPerDocument: number;
    cacheEnabled: boolean;
    liveEvalEnabled: boolean;
  };
};

export type RagDocumentSummary = {
  id: string;
  title: string;
  topic: string;
  sourceReliability: string;
  version: string;
  sourcePath: string;
  chunkCountEstimate: number;
  hasRequiredMetadata: boolean;
};

export type RagCacheStats = {
  enabled: boolean;
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
};

export type RagEvalCase = {
  id: string;
  query: string;
  expectedMode: "rag" | "boundary" | "no_source";
  expectedTopics: string[];
  requiredSourceTopics: string[];
  forbiddenPhrases: string[];
  notes: string;
};

export type RagEvalRunSummary = {
  mode: "mock" | "live";
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: Array<{
    id: string;
    query: string;
    expectedMode: "rag" | "boundary" | "no_source";
    actualMode: "rag" | "boundary" | "no_source";
    passed: boolean;
    score: number;
    sources: Array<{
      title: string;
      topic?: string;
      sourcePath: string;
      section?: string;
    }>;
    issues: string[];
  }>;
};

export function getAdminRagHealth(): Promise<ApiResponse<{ health: RagHealth }>> {
  return adminRequest("/api/v1/admin/rag/health");
}

export function listAdminRagDocuments(): Promise<ApiResponse<{ documents: RagDocumentSummary[] }>> {
  return adminRequest("/api/v1/admin/rag/documents");
}

export function listAdminRagEvalCases(): Promise<ApiResponse<{ cases: RagEvalCase[] }>> {
  return adminRequest("/api/v1/admin/rag/eval/cases");
}

export function runAdminRagEval(
  mode: "mock" | "live",
  limit = 20,
): Promise<ApiResponse<RagEvalRunSummary>> {
  return adminRequest("/api/v1/admin/rag/eval/run", {
    method: "POST",
    body: JSON.stringify({ mode, limit }),
  });
}

export function getAdminRagCacheStats(): Promise<ApiResponse<{ cache: RagCacheStats }>> {
  return adminRequest("/api/v1/admin/rag/cache/stats");
}

export function clearAdminRagCache(): Promise<ApiResponse<{ cache: RagCacheStats }>> {
  return adminRequest("/api/v1/admin/rag/cache/clear", {
    method: "POST",
  });
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await authFetch(getApiBaseUrl(), path, init);

    return (await response.json()) as ApiResponse<T>;
  } catch {
    return {
      ok: false,
      error: {
        code: "BACKOFFICE_REQUEST_FAILED",
        message: "Backoffice isteği tamamlanamadı.",
      },
    };
  }
}

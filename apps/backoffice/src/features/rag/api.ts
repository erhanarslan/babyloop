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
    missingMetadataCount: number;
    staleDocumentCount: number;
    reindexRequiredCount: number;
    topics: string[];
    sourceReliabilityCounts: Record<string, number>;
    indexingStatusCounts: Record<string, number>;
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
    cacheBackend: string;
    cacheBackendEffective: string;
    usageLimitsEnabled: boolean;
    usageBackend: string;
    usageBackendEffective: string;
    metricsEnabled: boolean;
    metricsBackend: string;
    metricsBackendEffective: string;
    liveEvalEnabled: boolean;
  };
  redis: {
    enabled: boolean;
    connected: boolean;
    backendEffective: "redis" | "memory" | "disabled";
  };
};

export type RagDocumentSummary = {
  id: string;
  title: string;
  topic: string;
  sourceReliability: string;
  version: string;
  sourcePath: string;
  checksum: string;
  checksumShort: string;
  chunkCountEstimate: number;
  hasRequiredMetadata: boolean;
  missingMetadataFields: string[];
  indexingStatus: "indexed" | "stale" | "missing" | "unknown";
  reindexRequired: boolean;
  lastIndexedAt: string | null;
};

export type RagDocumentChunks = {
  document: {
    id: string;
    title: string;
    sourcePath: string;
    topic: string;
    sourceReliability: string;
    version: string;
    checksumShort: string;
  };
  chunks: Array<{
    chunkId: string;
    chunkIndex: number;
    section: string;
    topic: string;
    sourceReliability: string;
    textPreview: string;
  }>;
};

export type RagReindexCheck = {
  totalDocuments: number;
  reindexRequired: number;
  stale: number;
  missing: number;
  unknown: number;
  documents: Array<{
    id: string;
    title: string;
    topic: string;
    sourcePath: string;
    version: string;
    checksumShort: string;
    indexingStatus: "indexed" | "stale" | "missing" | "unknown";
    reindexRequired: boolean;
  }>;
};

export type RagCacheStats = {
  enabled: boolean;
  backend: "memory" | "redis" | "disabled";
  backendEffective: "memory" | "redis" | "disabled";
  entries: number;
  hits: number;
  misses: number;
  sets: number;
  clears: number;
  hitRate: number;
};

export type RagMetrics = {
  enabled: boolean;
  backend: "memory" | "redis" | "disabled";
  backendEffective: "memory" | "redis" | "disabled";
  date: string;
  counters: Record<string, number>;
  byIntent: Record<string, number>;
  byMode: Record<string, number>;
  byTopic: Record<string, number>;
};

export type RagUsage = {
  enabled: boolean;
  backend: "memory" | "redis" | "disabled";
  backendEffective: "memory" | "redis" | "disabled";
  limits: {
    hourlyGuest: number;
    dailyGuest: number;
    hourlyUser: number;
    dailyUser: number;
    adminBypass: boolean;
  };
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
  runId?: string;
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

export type RagPlaygroundResponse = {
  query: {
    original: string;
    normalized: string;
    retrievalQuery: string;
    tokens: string[];
    productTerms: string[];
    ageSignals: string[];
    locationSignals: string[];
    topicHints: string[];
  };
  mode: "search" | "answer";
  diagnostics: {
    noSource: boolean;
    minScore: number;
    hybridEnabled: boolean;
    limit: number;
    warnings: string[];
  };
  results: Array<{
    rank: number;
    score: number;
    vectorScore: number;
    finalScore: number;
    title: string;
    section?: string;
    topic?: string;
    sourceReliability?: string;
    sourcePath: string;
    textPreview: string;
    qualitySignals: {
      lexicalScore: number;
      titleMatch: boolean;
      sectionMatch: boolean;
      topicMatch: boolean;
      sourceReliabilityBonus: number;
      duplicatePenalty: number;
    };
  }>;
  answerPreview: null | {
    answer: string;
    mode: "rag" | "boundary" | "no_sources";
    grounded: boolean;
    sources: Array<{
      title: string;
      topic?: string;
      sourcePath: string;
      section?: string;
      sourceReliability?: string;
    }>;
    intent?: string;
    toolsUsed?: string[];
  };
};

export type RagEvalHistoryListItem = {
  runId: string;
  mode: "mock" | "live";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  status: "completed" | "failed";
};

export type RagEvalHistoryDetail = RagEvalHistoryListItem & {
  results: RagEvalRunSummary["results"];
};

export type RagReindexRunResult = {
  mode: "check" | "full";
  status: "checked" | "manual_command_required";
  check: RagReindexCheck;
  manualCommand?: string;
  automaticExecutionEnabled: boolean;
  warning?: string;
};

export function getAdminRagHealth(): Promise<ApiResponse<{ health: RagHealth }>> {
  return adminRequest("/api/v1/admin/rag/health");
}

export function listAdminRagDocuments(): Promise<ApiResponse<{ documents: RagDocumentSummary[] }>> {
  return adminRequest("/api/v1/admin/rag/documents");
}

export function getAdminRagDocumentChunks(documentId: string): Promise<ApiResponse<RagDocumentChunks>> {
  return adminRequest(`/api/v1/admin/rag/documents/${encodeURIComponent(documentId)}/chunks`);
}

export function getAdminRagReindexCheck(): Promise<ApiResponse<RagReindexCheck>> {
  return adminRequest("/api/v1/admin/rag/reindex/check");
}

export function runAdminRagPlaygroundQuery(input: {
  query: string;
  mode: "search" | "answer";
  limit: number;
  debug?: boolean;
}): Promise<ApiResponse<RagPlaygroundResponse>> {
  return adminRequest("/api/v1/admin/rag/playground/query", {
    method: "POST",
    body: JSON.stringify(input),
  });
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

export function getAdminRagEvalHistory(): Promise<ApiResponse<{ runs: RagEvalHistoryListItem[] }>> {
  return adminRequest("/api/v1/admin/rag/eval/history");
}

export function getAdminRagEvalHistoryDetail(runId: string): Promise<ApiResponse<{ run: RagEvalHistoryDetail }>> {
  return adminRequest(`/api/v1/admin/rag/eval/history/${encodeURIComponent(runId)}`);
}

export function getAdminRagCacheStats(): Promise<ApiResponse<{ cache: RagCacheStats }>> {
  return adminRequest("/api/v1/admin/rag/cache/stats");
}

export function getAdminRagMetrics(): Promise<ApiResponse<{ metrics: RagMetrics }>> {
  return adminRequest("/api/v1/admin/rag/metrics");
}

export function getAdminRagUsage(): Promise<ApiResponse<{ usage: RagUsage }>> {
  return adminRequest("/api/v1/admin/rag/usage");
}

export function clearAdminRagCache(): Promise<ApiResponse<{ cache: RagCacheStats }>> {
  return adminRequest("/api/v1/admin/rag/cache/clear", {
    method: "POST",
  });
}

export function runAdminRagReindex(input: {
  mode: "check" | "full";
  confirm?: string;
}): Promise<ApiResponse<RagReindexRunResult>> {
  return adminRequest("/api/v1/admin/rag/reindex/run", {
    method: "POST",
    body: JSON.stringify(input),
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

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RagRuntimeConfig } from "../config/env.js";
import type { QdrantVectorStore } from "./rag-qdrant-vector-store.service.js";
import type { RagCacheService } from "./rag-cache.service.js";
import {
  RagKnowledgeGovernanceService,
  type RagKnowledgeGovernanceVectorStore,
  type RagReindexCheckSummary
} from "./rag-knowledge-governance.service.js";
import type { RagMetricsService } from "./rag-metrics.service.js";
import type { RagRedisClient, RagRedisStatus } from "./rag-redis.service.js";
import type { RagUsageLimitService } from "./rag-usage-limits.service.js";
import type {
  RagCollectionInfo,
  RagDocumentChunkPreviewResponse,
  RagDocumentGovernanceSummary
} from "./rag.types.js";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

export type RagDocumentOperationSummary = RagDocumentGovernanceSummary;

export type RagHealthSummary = {
  enabled: boolean;
  vectorStore: "qdrant" | "disabled";
  collection: string | null;
  qdrant: RagCollectionInfo;
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
  redis: RagRedisStatus;
};

export type RagOperationsServiceOptions = {
  config: RagRuntimeConfig;
  cacheService?: Pick<RagCacheService, "getBackendSummary"> | null;
  docsRoot?: string;
  metricsService?: Pick<RagMetricsService, "getBackendSummary"> | null;
  redisClient?: Pick<RagRedisClient, "status"> | null;
  usageLimitService?: Pick<RagUsageLimitService, "summary"> | null;
  vectorStore?: Pick<QdrantVectorStore, "getCollectionInfo"> & Partial<RagKnowledgeGovernanceVectorStore> | null;
};

export class RagOperationsService {
  private readonly config: RagRuntimeConfig;
  private readonly cacheService: Pick<RagCacheService, "getBackendSummary"> | null;
  private readonly docsRoot: string;
  private readonly metricsService: Pick<RagMetricsService, "getBackendSummary"> | null;
  private readonly redisClient: Pick<RagRedisClient, "status"> | null;
  private readonly usageLimitService: Pick<RagUsageLimitService, "summary"> | null;
  private readonly vectorStore: (Pick<QdrantVectorStore, "getCollectionInfo"> & Partial<RagKnowledgeGovernanceVectorStore>) | null;

  constructor(options: RagOperationsServiceOptions) {
    this.config = options.config;
    this.cacheService = options.cacheService ?? null;
    this.docsRoot = options.docsRoot ?? path.join(REPO_ROOT, "docs", "rag");
    this.metricsService = options.metricsService ?? null;
    this.redisClient = options.redisClient ?? null;
    this.usageLimitService = options.usageLimitService ?? null;
    this.vectorStore = options.vectorStore ?? null;
  }

  async getHealth(): Promise<RagHealthSummary> {
    const documents = await this.listDocuments();
    const cache = this.cacheService?.getBackendSummary() ?? {
      enabled: false,
      backend: "disabled",
      backendEffective: "disabled"
    };
    const usage = this.usageLimitService?.summary() ?? {
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
    };
    const metrics = this.metricsService?.getBackendSummary() ?? {
      enabled: false,
      backend: "disabled",
      backendEffective: "disabled"
    };
    const qdrant = await this.getCollectionInfoSafely();

    return {
      enabled: this.config.enabled,
      vectorStore: this.config.enabled ? this.config.vectorStore : "disabled",
      collection: this.config.enabled ? this.config.qdrantCollection : null,
      qdrant,
      docs: {
        documentCount: documents.length,
        chunkCountEstimate: documents.reduce((total, document) => total + document.chunkCountEstimate, 0),
        missingMetadataCount: documents.filter((document) => !document.hasRequiredMetadata).length,
        staleDocumentCount: documents.filter((document) => document.indexingStatus === "stale").length,
        reindexRequiredCount: documents.filter((document) => document.reindexRequired).length,
        topics: [...new Set(documents.map((document) => document.topic))].sort((left, right) => left.localeCompare(right)),
        sourceReliabilityCounts: countBy(documents.map((document) => document.sourceReliability)),
        indexingStatusCounts: countBy(documents.map((document) => document.indexingStatus))
      },
      config: {
        embeddingProvider: this.config.enabled ? this.config.embeddingProvider : "unavailable",
        embeddingModel: this.config.enabled ? this.config.embeddingModel : "unavailable",
        chatProvider: this.config.enabled ? this.config.chatProvider : "unavailable",
        chatModel: this.config.enabled ? this.config.chatModel : "unavailable",
        minScore: this.config.enabled ? this.config.minScore : 0,
        maxChunks: this.config.enabled ? this.config.maxChunks : 0,
        maxSourcesPerDocument: this.config.enabled ? this.config.maxSourcesPerDocument : 0,
        cacheEnabled: cache.enabled,
        cacheBackend: cache.backend,
        cacheBackendEffective: cache.backendEffective,
        usageLimitsEnabled: usage.enabled,
        usageBackend: usage.backend,
        usageBackendEffective: usage.backendEffective,
        metricsEnabled: metrics.enabled,
        metricsBackend: metrics.backend,
        metricsBackendEffective: metrics.backendEffective,
        liveEvalEnabled: this.config.enabled ? this.config.liveEvalEnabled : false
      },
      redis: this.redisClient?.status(
        cache.backendEffective === "redis" || usage.backendEffective === "redis" || metrics.backendEffective === "redis"
          ? "redis"
          : cache.backendEffective === "disabled" && usage.backendEffective === "disabled" && metrics.backendEffective === "disabled"
            ? "disabled"
            : "memory"
      ) ?? {
        enabled: false,
        connected: false,
        backendEffective: "disabled"
      }
    };
  }

  async listDocuments(): Promise<RagDocumentOperationSummary[]> {
    return this.createGovernanceService().listDocuments();
  }

  async getDocumentChunks(documentId: string): Promise<RagDocumentChunkPreviewResponse | null> {
    return this.createGovernanceService().getChunkPreview(documentId);
  }

  async getReindexCheck(): Promise<RagReindexCheckSummary> {
    return this.createGovernanceService().getReindexCheck();
  }

  private createGovernanceService(): RagKnowledgeGovernanceService {
    return new RagKnowledgeGovernanceService({
      docsRoot: this.docsRoot,
      textPreviewChars: this.config.enabled ? this.config.governanceTextPreviewChars : 280,
      vectorStore: hasIndexSnapshotReader(this.vectorStore) ? this.vectorStore : null
    });
  }

  private async getCollectionInfoSafely(): Promise<RagCollectionInfo> {
    const fallback = {
      status: "unknown" as const,
      pointsCount: 0,
      vectorSize: this.config.enabled ? this.config.qdrantVectorSize : 0,
      indexedVectorsCount: 0
    };

    if (!this.config.enabled || !this.vectorStore) {
      return fallback;
    }

    try {
      return await this.vectorStore.getCollectionInfo();
    } catch {
      return fallback;
    }
  }
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function hasIndexSnapshotReader(
  value: (Pick<QdrantVectorStore, "getCollectionInfo"> & Partial<RagKnowledgeGovernanceVectorStore>) | null
): value is Pick<QdrantVectorStore, "getCollectionInfo"> & RagKnowledgeGovernanceVectorStore {
  return Boolean(value && typeof value.getIndexedDocumentSnapshots === "function");
}

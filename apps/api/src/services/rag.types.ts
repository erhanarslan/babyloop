import type { AssistantIntent } from "./assistant-intent-router.service.js";

export type RagSourceReliability =
  | "internal-policy"
  | "internal"
  | "editorial"
  | "official-source-note"
  | "official-referenced";

export type RagIndexingStatus = "indexed" | "stale" | "missing" | "unknown";

export type RagDocumentMetadata = {
  id: string;
  title: string;
  locale: string;
  topic: string;
  safetyScope: string;
  sourceReliability: RagSourceReliability | string;
  version: string;
  sourcePath: string;
};

export type RagDocument = {
  metadata: RagDocumentMetadata;
  content: string;
};

export type RagChunkMetadata = RagDocumentMetadata & {
  checksum?: string;
  checksumShort?: string;
  chunkId?: string;
  contentLength?: number;
  documentId: string;
  documentTitle?: string;
  indexedAt?: string;
  section: string;
  chunkIndex: number;
};

export type RagChunk = {
  id: string;
  text: string;
  metadata: RagChunkMetadata;
};

export type RagDocumentGovernanceSummary = {
  id: string;
  title: string;
  locale: string;
  topic: string;
  safetyScope: string;
  sourceReliability: string;
  version: string;
  sourcePath: string;
  checksum: string;
  checksumShort: string;
  chunkCountEstimate: number;
  hasRequiredMetadata: boolean;
  missingMetadataFields: string[];
  indexingStatus: RagIndexingStatus;
  reindexRequired: boolean;
  lastIndexedAt: string | null;
};

export type RagChunkPreview = {
  chunkId: string;
  chunkIndex: number;
  section: string;
  topic: string;
  sourceReliability: string;
  textPreview: string;
};

export type RagDocumentChunkPreviewResponse = {
  document: Pick<
    RagDocumentGovernanceSummary,
    "checksumShort" | "id" | "sourcePath" | "sourceReliability" | "title" | "topic" | "version"
  >;
  chunks: RagChunkPreview[];
};

export type RagIndexedDocumentSnapshot = {
  chunkCount: number;
  checksum: string | null;
  checksumShort: string | null;
  indexedAt: string | null;
  version: string | null;
};

export type RagCitation = {
  title: string;
  sourcePath: string;
  section?: string;
  topic?: string;
  sourceReliability?: string;
};

export type RagSearchResult = {
  score: number;
  text: string;
  citation: RagCitation;
};

export type RagAnswer = {
  answer: string;
  sources: RagCitation[];
  mode: "rag" | "boundary" | "no_sources";
  grounded: boolean;
  cacheHit?: boolean;
  intent?: AssistantIntent;
  toolsUsed?: string[];
  toolResultsPreview?: Array<{
    tool: string;
    title: string;
    summary: string;
  }>;
  suggestedActions?: Array<{
    type: "open_listing" | "open_search" | "copy_questions" | "review_saved_search_draft" | "review_listing_draft" | "review_child_recommendations";
    label: string;
    href?: string;
    payload?: Record<string, unknown>;
  }>;
};

export type RagSafetyDecision = {
  allowed: boolean;
  reason:
    | "marketplace"
    | "parent_product_guide"
    | "listing_help"
    | "babyloop_usage"
    | "everyday_care"
    | "preconception_pregnancy"
    | "unsafe_medical"
    | "prompt_injection"
    | "unknown";
  boundaryAnswer?: string;
};

export type RagIngestionResult = {
  documentCount: number;
  chunkCount: number;
  collectionName: string;
  skippedFiles: string[];
  errors: string[];
};

export type RagVectorStore = {
  ensureCollection(): Promise<void>;
  upsertChunks(chunks: Array<RagChunk & { embedding: number[] }>): Promise<void>;
  search(options: {
    queryEmbedding: number[];
    limit: number;
    minScore: number;
  }): Promise<RagSearchResult[]>;
};

export type RagCollectionInfo = {
  status: "green" | "yellow" | "red" | "unknown";
  pointsCount: number;
  vectorSize: number;
  indexedVectorsCount: number;
};

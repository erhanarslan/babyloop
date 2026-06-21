import type { AssistantIntent } from "./assistant-intent-router.service.js";

export type RagDocumentMetadata = {
  id: string;
  title: string;
  locale: string;
  topic: string;
  safetyScope: string;
  sourceReliability: string;
  version: string;
  sourcePath: string;
};

export type RagDocument = {
  metadata: RagDocumentMetadata;
  content: string;
};

export type RagChunkMetadata = RagDocumentMetadata & {
  documentId: string;
  section: string;
  chunkIndex: number;
};

export type RagChunk = {
  id: string;
  text: string;
  metadata: RagChunkMetadata;
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
};

export type RagSafetyDecision = {
  allowed: boolean;
  reason:
    | "marketplace"
    | "parent_product_guide"
    | "listing_help"
    | "babyloop_usage"
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

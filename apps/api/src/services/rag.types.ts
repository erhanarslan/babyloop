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
  answerOwner?: string | undefined;
  allowedDomains?: string[] | undefined;
  forbiddenDomains?: string[] | undefined;
  questionFamilies?: string[] | undefined;
  ageBands?: string[] | undefined;
  sectionKind?: "answer" | "boundary" | "source_note" | "routing" | "policy" | undefined;
  riskLevel?: "low" | "medium" | "high" | undefined;
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
  section?: string | undefined;
  topic?: string | undefined;
  sourceReliability?: string | undefined;
  answerOwner?: string | undefined;
  sectionKind?: string | undefined;
};

export type RagSearchResult = {
  score: number;
  text: string;
  citation: RagCitation;
  diagnostics?: {
    lexicalScore?: number | undefined;
    vectorScore?: number | undefined;
    finalScore?: number | undefined;
    rejectReason?: string | undefined;
  };
};

export type RagAnswer = {
  answer: string;
  sources: RagCitation[];
  mode: "rag" | "boundary" | "no_sources";
  grounded: boolean;
  cacheHit?: boolean | undefined;
  intent?: AssistantIntent | undefined;
  domain?: string | undefined;
  routeConfidence?: "low" | "medium" | "high" | undefined;
  groundingStatus?: "grounded" | "insufficient_sources" | "blocked_safety" | "owner_missing" | "cross_domain_contamination" | "low_confidence" | "unsupported_claims" | undefined;
  blockedReason?: string | undefined;
  sourceOwner?: string | undefined;
  sourceReliability?: string | undefined;
  citationCoverage?: number | undefined;
  retrievalDiagnosticsSummary?: {
    canonicalOwnerFound?: boolean | undefined;
    crossDomainContamination?: boolean | undefined;
    rejectedReasons?: string[] | undefined;
    selectedSourceTopics?: string[] | undefined;
  };
  toolsUsed?: string[] | undefined;
  toolResultsPreview?: Array<{
    tool: string;
    title: string;
    summary: string;
  }> | undefined;
  suggestedActions?: Array<{
    type: "open_listing" | "open_search" | "copy_questions" | "review_saved_search_draft" | "review_listing_draft" | "review_child_recommendations";
    label: string;
    href?: string | undefined;
    payload?: Record<string, unknown> | undefined;
  }> | undefined;
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
  filter?: RagVectorSearchFilter | undefined;
    queryEmbedding: number[];
    limit: number;
    minScore: number;
  }): Promise<RagSearchResult[]>;
};

export type RagVectorSearchFilter = {
  allowedSourcePaths?: string[] | undefined;
  allowedTopics?: string[] | undefined;
  forbiddenSourcePaths?: string[] | undefined;
  forbiddenTopics?: string[] | undefined;
  minimumReliability?: string | undefined;
  requiredOwner?: string | undefined;
};

export type RagCollectionInfo = {
  status: "green" | "yellow" | "red" | "unknown";
  pointsCount: number;
  vectorSize: number;
  indexedVectorsCount: number;
};

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chunkRagDocument } from "./rag-chunking.service.js";
import {
  loadRagDocuments,
  parseMarkdownWithFrontmatter
} from "./rag-markdown-loader.service.js";
import type {
  RagChunkPreview,
  RagDocument,
  RagDocumentChunkPreviewResponse,
  RagDocumentGovernanceSummary,
  RagIndexedDocumentSnapshot,
  RagIndexingStatus,
  RagSourceReliability
} from "./rag.types.js";

export const RAG_REQUIRED_FRONTMATTER = [
  "id",
  "title",
  "locale",
  "topic",
  "safetyScope",
  "sourceReliability",
  "version"
] as const;

export const RAG_ALLOWED_SOURCE_RELIABILITY: RagSourceReliability[] = [
  "internal-policy",
  "internal",
  "editorial",
  "official-source-note",
  "official-referenced"
];

export type RagKnowledgeGovernanceVectorStore = {
  getIndexedDocumentSnapshots(documentIds: string[]): Promise<Map<string, RagIndexedDocumentSnapshot>>;
};

export type RagReindexCheckSummary = {
  totalDocuments: number;
  reindexRequired: number;
  stale: number;
  missing: number;
  unknown: number;
};

export class RagKnowledgeGovernanceService {
  private readonly docsRoot: string;
  private readonly textPreviewChars: number;
  private readonly vectorStore: RagKnowledgeGovernanceVectorStore | null;

  constructor(options: {
    docsRoot: string;
    textPreviewChars: number;
    vectorStore?: RagKnowledgeGovernanceVectorStore | null;
  }) {
    this.docsRoot = options.docsRoot;
    this.textPreviewChars = options.textPreviewChars;
    this.vectorStore = options.vectorStore ?? null;
  }

  async listDocuments(): Promise<RagDocumentGovernanceSummary[]> {
    const records = await this.loadDocumentRecords();
    const snapshots = await this.readIndexSnapshots(records.map((record) => record.document.metadata.id));

    return records.map((record) => {
      const chunks = chunkRagDocument(record.document);
      const snapshot = snapshots?.get(record.document.metadata.id) ?? null;
      const status = determineIndexingStatus({
        checksum: record.checksum,
        chunkCountEstimate: chunks.length,
        snapshot,
        version: record.document.metadata.version
      });

      return {
        id: record.document.metadata.id,
        title: record.document.metadata.title,
        locale: record.document.metadata.locale,
        topic: record.document.metadata.topic,
        safetyScope: record.document.metadata.safetyScope,
        sourceReliability: record.document.metadata.sourceReliability,
        version: record.document.metadata.version,
        sourcePath: record.document.metadata.sourcePath,
        checksum: record.checksum,
        checksumShort: record.checksumShort,
        chunkCountEstimate: chunks.length,
        hasRequiredMetadata: record.missingMetadataFields.length === 0,
        missingMetadataFields: record.missingMetadataFields,
        indexingStatus: status,
        reindexRequired: status !== "indexed",
        lastIndexedAt: snapshot?.indexedAt ?? null
      };
    });
  }

  async getReindexCheck(): Promise<RagReindexCheckSummary> {
    const documents = await this.listDocuments();

    return {
      totalDocuments: documents.length,
      reindexRequired: documents.filter((document) => document.reindexRequired).length,
      stale: documents.filter((document) => document.indexingStatus === "stale").length,
      missing: documents.filter((document) => document.indexingStatus === "missing").length,
      unknown: documents.filter((document) => document.indexingStatus === "unknown").length
    };
  }

  async getChunkPreview(documentId: string): Promise<RagDocumentChunkPreviewResponse | null> {
    const sanitizedDocumentId = sanitizeDocumentId(documentId);

    if (!sanitizedDocumentId) {
      return null;
    }

    const records = await this.loadDocumentRecords();
    const record = records.find((candidate) => candidate.document.metadata.id === sanitizedDocumentId);

    if (!record) {
      return null;
    }

    const chunks = chunkRagDocument(record.document);

    return {
      document: {
        id: record.document.metadata.id,
        title: record.document.metadata.title,
        sourcePath: record.document.metadata.sourcePath,
        topic: record.document.metadata.topic,
        sourceReliability: record.document.metadata.sourceReliability,
        version: record.document.metadata.version,
        checksumShort: record.checksumShort
      },
      chunks: chunks.map((chunk): RagChunkPreview => ({
        chunkId: chunk.id,
        chunkIndex: chunk.metadata.chunkIndex,
        section: chunk.metadata.section,
        topic: chunk.metadata.topic,
        sourceReliability: chunk.metadata.sourceReliability,
        textPreview: previewText(chunk.text, this.textPreviewChars)
      }))
    };
  }

  private async loadDocumentRecords(): Promise<Array<{
    checksum: string;
    checksumShort: string;
    document: RagDocument;
    missingMetadataFields: string[];
  }>> {
    const documents = await loadRagDocuments(this.docsRoot);
    const frontmatterBySourcePath = await readRawFrontmatter(this.docsRoot);

    return documents.map((document) => {
      const frontmatter = frontmatterBySourcePath.get(document.metadata.sourcePath) ?? {};
      const checksum = checksumRagDocument(document);
      const missingRequired = RAG_REQUIRED_FRONTMATTER.filter((field) => !frontmatter[field]);
      const invalidReliability = isAllowedSourceReliability(frontmatter.sourceReliability)
        ? []
        : ["sourceReliability"];
      const missingMetadataFields = [...new Set([...missingRequired, ...invalidReliability])];

      return {
        checksum,
        checksumShort: checksum.slice(0, 12),
        document,
        missingMetadataFields
      };
    });
  }

  private async readIndexSnapshots(documentIds: string[]): Promise<Map<string, RagIndexedDocumentSnapshot> | null> {
    if (!this.vectorStore) {
      return null;
    }

    try {
      return await this.vectorStore.getIndexedDocumentSnapshots(documentIds);
    } catch {
      return null;
    }
  }
}

export function checksumDocument(value: string): string {
  return createHash("sha256").update(value.normalize("NFC")).digest("hex");
}

export function checksumRagDocument(document: RagDocument): string {
  return checksumDocument([
    `id: ${document.metadata.id}`,
    `title: ${document.metadata.title}`,
    `locale: ${document.metadata.locale}`,
    `topic: ${document.metadata.topic}`,
    `safetyScope: ${document.metadata.safetyScope}`,
    `sourceReliability: ${document.metadata.sourceReliability}`,
    `version: ${document.metadata.version}`,
    "",
    document.content
  ].join("\n"));
}

function determineIndexingStatus(input: {
  checksum: string;
  chunkCountEstimate: number;
  snapshot: RagIndexedDocumentSnapshot | null;
  version: string;
}): RagIndexingStatus {
  if (!input.snapshot) {
    return "unknown";
  }

  if (input.snapshot.chunkCount === 0) {
    return "missing";
  }

  if (
    input.snapshot.checksum === input.checksum &&
    input.snapshot.version === input.version &&
    input.snapshot.chunkCount === input.chunkCountEstimate &&
    input.snapshot.indexedAt
  ) {
    return "indexed";
  }

  return "stale";
}

function isAllowedSourceReliability(value: string | undefined): boolean {
  return Boolean(value && RAG_ALLOWED_SOURCE_RELIABILITY.includes(value as RagSourceReliability));
}

function previewText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/gu, " ").trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxChars - 1, 1)).trim()}…`;
}

function sanitizeDocumentId(value: string): string | null {
  const normalized = value.trim();
  return /^[a-z0-9][a-z0-9_-]{1,120}$/iu.test(normalized) ? normalized : null;
}

async function readRawFrontmatter(docsRoot: string): Promise<Map<string, Record<string, string>>> {
  const entries = await fs.readdir(docsRoot, { withFileTypes: true });
  const frontmatterBySourcePath = new Map<string, Record<string, string>>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const sourcePath = path.posix.join("docs/rag", entry.name);
    const raw = await fs.readFile(path.join(docsRoot, entry.name), "utf8");
    frontmatterBySourcePath.set(sourcePath, parseMarkdownWithFrontmatter(raw).frontmatter);
  }

  return frontmatterBySourcePath;
}

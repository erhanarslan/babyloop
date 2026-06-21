import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RagRuntimeConfig } from "../config/env.js";
import { chunkRagDocument } from "./rag-chunking.service.js";
import {
  loadRagDocuments,
  parseMarkdownWithFrontmatter
} from "./rag-markdown-loader.service.js";
import type { QdrantVectorStore } from "./rag-qdrant-vector-store.service.js";
import type { RagCollectionInfo } from "./rag.types.js";

const REQUIRED_FRONTMATTER = [
  "id",
  "title",
  "locale",
  "topic",
  "safetyScope",
  "sourceReliability",
  "version"
] as const;

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

export type RagDocumentOperationSummary = {
  id: string;
  title: string;
  topic: string;
  sourceReliability: string;
  version: string;
  sourcePath: string;
  chunkCountEstimate: number;
  hasRequiredMetadata: boolean;
};

export type RagHealthSummary = {
  enabled: boolean;
  vectorStore: "qdrant" | "disabled";
  collection: string | null;
  qdrant: RagCollectionInfo;
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

export type RagOperationsServiceOptions = {
  config: RagRuntimeConfig;
  docsRoot?: string;
  vectorStore?: Pick<QdrantVectorStore, "getCollectionInfo"> | null;
};

export class RagOperationsService {
  private readonly config: RagRuntimeConfig;
  private readonly docsRoot: string;
  private readonly vectorStore: Pick<QdrantVectorStore, "getCollectionInfo"> | null;

  constructor(options: RagOperationsServiceOptions) {
    this.config = options.config;
    this.docsRoot = options.docsRoot ?? path.join(REPO_ROOT, "docs", "rag");
    this.vectorStore = options.vectorStore ?? null;
  }

  async getHealth(): Promise<RagHealthSummary> {
    const documents = await this.listDocuments();
    const qdrant = this.config.enabled && this.vectorStore
      ? await this.vectorStore.getCollectionInfo()
      : {
        status: "unknown" as const,
        pointsCount: 0,
        vectorSize: this.config.enabled ? this.config.qdrantVectorSize : 0,
        indexedVectorsCount: 0
      };

    return {
      enabled: this.config.enabled,
      vectorStore: this.config.enabled ? this.config.vectorStore : "disabled",
      collection: this.config.enabled ? this.config.qdrantCollection : null,
      qdrant,
      docs: {
        documentCount: documents.length,
        chunkCountEstimate: documents.reduce((total, document) => total + document.chunkCountEstimate, 0),
        topics: [...new Set(documents.map((document) => document.topic))].sort((left, right) => left.localeCompare(right)),
        sourceReliabilityCounts: countBy(documents.map((document) => document.sourceReliability))
      },
      config: {
        embeddingProvider: this.config.enabled ? this.config.embeddingProvider : "unavailable",
        embeddingModel: this.config.enabled ? this.config.embeddingModel : "unavailable",
        chatProvider: this.config.enabled ? this.config.chatProvider : "unavailable",
        chatModel: this.config.enabled ? this.config.chatModel : "unavailable",
        minScore: this.config.enabled ? this.config.minScore : 0,
        maxChunks: this.config.enabled ? this.config.maxChunks : 0,
        maxSourcesPerDocument: this.config.enabled ? this.config.maxSourcesPerDocument : 0,
        cacheEnabled: this.config.enabled ? this.config.cacheEnabled : false,
        liveEvalEnabled: this.config.enabled ? this.config.liveEvalEnabled : false
      }
    };
  }

  async listDocuments(): Promise<RagDocumentOperationSummary[]> {
    const documents = await loadRagDocuments(this.docsRoot);
    const metadataStatus = await readFrontmatterStatus(this.docsRoot);

    return documents.map((document) => ({
      id: document.metadata.id,
      title: document.metadata.title,
      topic: document.metadata.topic,
      sourceReliability: document.metadata.sourceReliability,
      version: document.metadata.version,
      sourcePath: document.metadata.sourcePath,
      chunkCountEstimate: chunkRagDocument(document).length,
      hasRequiredMetadata: metadataStatus.get(document.metadata.sourcePath) ?? false
    }));
  }
}

async function readFrontmatterStatus(docsRoot: string): Promise<Map<string, boolean>> {
  const entries = await fs.readdir(docsRoot, { withFileTypes: true });
  const status = new Map<string, boolean>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const sourcePath = path.posix.join("docs/rag", entry.name);
    const rawContent = await fs.readFile(path.join(docsRoot, entry.name), "utf8");
    const parsed = parseMarkdownWithFrontmatter(rawContent);

    status.set(
      sourcePath,
      REQUIRED_FRONTMATTER.every((field) => Boolean(parsed.frontmatter[field]))
    );
  }

  return status;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

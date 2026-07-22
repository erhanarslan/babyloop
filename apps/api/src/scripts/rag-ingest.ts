import { fileURLToPath } from "node:url";
import path from "node:path";
import { GeminiEmbeddingProvider, type EmbeddingInput } from "@babyloop/ai-core";
import { readApiRuntimeConfig } from "../config/env.js";
import { chunkRagDocument } from "../services/rag-chunking.service.js";
import { checksumRagDocument } from "../services/rag-knowledge-governance.service.js";
import { loadRagDocuments } from "../services/rag-markdown-loader.service.js";
import { QdrantVectorStore } from "../services/rag-qdrant-vector-store.service.js";

const DEFAULT_EMBED_DELAY_MS = 1_500;
const DEFAULT_MAX_EMBED_RETRIES = 5;

async function main(): Promise<void> {
  const config = readApiRuntimeConfig();

  if (!config.rag.enabled) {
    throw new Error("RAG_ENABLED=true olmadan ingestion çalıştırılamaz.");
  }

  const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
  const docsRoot = path.join(repoRoot, "docs", "rag");
  const documents = await loadRagDocuments(docsRoot);
  const indexedAt = new Date().toISOString();
  const checksumByDocumentId = new Map(documents.map((document) => {
    const checksum = checksumRagDocument(document);
    return [document.metadata.id, {
      checksum,
      checksumShort: checksum.slice(0, 12)
    }];
  }));
  const chunks = documents.flatMap((document) => chunkRagDocument(document).map((chunk) => {
    const checksum = checksumByDocumentId.get(document.metadata.id);

    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        documentTitle: document.metadata.title,
        ...(checksum ? {
          checksum: checksum.checksum,
          checksumShort: checksum.checksumShort
        } : {}),
        chunkId: chunk.id,
        indexedAt,
        contentLength: chunk.text.length
      }
    };
  }));
  const embeddingProvider = new GeminiEmbeddingProvider({
    apiKey: config.rag.geminiApiKey,
    model: config.rag.embeddingModel,
    outputDimension: config.rag.qdrantVectorSize,
    ...(config.rag.geminiEndpoint ? { endpoint: config.rag.geminiEndpoint } : {})
  });
  const vectorStore = new QdrantVectorStore({
    collectionName: config.rag.qdrantCollection,
    ...(config.rag.qdrantApiKey ? { apiKey: config.rag.qdrantApiKey } : {}),
    url: config.rag.qdrantUrl,
    vectorSize: config.rag.qdrantVectorSize
  });

  await vectorStore.ensureCollection();
  await vectorStore.ensureSearchPayloadIndexes();

  const embeddedChunks = [];
  const errors: string[] = [];

  const embedDelayMs = readNonNegativeIntegerFromEnv("RAG_INGEST_EMBED_DELAY_MS", DEFAULT_EMBED_DELAY_MS);
  const maxEmbedRetries = readPositiveIntegerFromEnv("RAG_INGEST_MAX_RETRIES", DEFAULT_MAX_EMBED_RETRIES);

  for (const chunk of chunks) {
    try {
      const embedding = await embedTextWithRetry(embeddingProvider, {
        purpose: "document",
        text: chunk.text,
        ...(chunk.metadata.documentTitle ? { title: chunk.metadata.documentTitle } : {})
      }, {
        delayMs: embedDelayMs,
        maxRetries: maxEmbedRetries
      });

      embeddedChunks.push({
        ...chunk,
        embedding: embedding.embedding
      });

      if (embedDelayMs > 0) {
        await sleep(embedDelayMs);
      }
    } catch (error) {
      errors.push(`${chunk.metadata.sourcePath}#${chunk.metadata.chunkIndex}: ${safeErrorMessage(error)}`);
    }
  }

  await vectorStore.upsertChunks(embeddedChunks);

  console.log(
    JSON.stringify(
      {
        documentCount: documents.length,
        chunkCount: embeddedChunks.length,
        collectionName: config.rag.qdrantCollection,
        skippedFiles: [],
        errors
      },
      null,
      2
    )
  );
}

type GeminiEmbeddingResult = Awaited<ReturnType<GeminiEmbeddingProvider["embedText"]>>;

async function embedTextWithRetry(
  embeddingProvider: GeminiEmbeddingProvider,
  input: EmbeddingInput,
  options: {
    delayMs: number;
    maxRetries: number;
  }
): Promise<GeminiEmbeddingResult> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    try {
      return await embeddingProvider.embedText(input);
    } catch (error) {
      lastError = error;

      if (!isRetryableEmbeddingError(error) || attempt === options.maxRetries) {
        throw error;
      }

      const backoffMs = options.delayMs * attempt;

      if (backoffMs > 0) {
        await sleep(backoffMs);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini embedding request failed.");
}

function isRetryableEmbeddingError(error: unknown): boolean {
  return /status\s+(?:408|429|5\d\d)\b/u.test(safeErrorMessage(error));
}

function readNonNegativeIntegerFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readPositiveIntegerFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Bilinmeyen hata";
}

main().catch((error: unknown) => {
  console.error(safeErrorMessage(error));
  process.exitCode = 1;
});

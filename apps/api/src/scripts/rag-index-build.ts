import { GeminiEmbeddingProvider, type EmbeddingInput } from "@babyloop/ai-core";
import { readApiRuntimeConfig } from "../config/env.js";
import {
  assertCandidateCollectionName,
  createBlueGreenVectorStore,
  prepareRagIndex
} from "../services/rag-index-deployment.service.js";

const DEFAULT_EMBED_DELAY_MS = 1_500;
const DEFAULT_MAX_EMBED_RETRIES = 5;

async function main(): Promise<void> {
  if (process.env.RAG_INDEX_BUILD_ENABLED !== "true") {
    throw new Error("RAG_INDEX_BUILD_ENABLED=true olmadan candidate index build çalıştırılamaz.");
  }

  const targetCollection = readRequiredEnv("RAG_INDEX_TARGET_COLLECTION");
  const allowExisting = process.env.RAG_INDEX_ALLOW_EXISTING === "true";
  const config = readApiRuntimeConfig();

  if (!config.rag.enabled) {
    throw new Error("RAG_ENABLED=true olmadan candidate index build çalıştırılamaz.");
  }

  const vectorStore = createBlueGreenVectorStore(config.rag, targetCollection);
  const aliases = await vectorStore.listAliases();
  assertCandidateCollectionName(targetCollection, {
    aliases,
    runtimeCollection: config.rag.qdrantCollection
  });

  if (await vectorStore.collectionExists(targetCollection)) {
    if (!allowExisting) {
      throw new Error("Target collection already exists. Set RAG_INDEX_ALLOW_EXISTING=true only when intentionally resuming a safe candidate build.");
    }
  } else {
    await vectorStore.createNamedCollection(targetCollection);
  }

  const prepared = await prepareRagIndex({
    embeddingModel: config.rag.embeddingModel,
    indexVersion: targetCollection,
    textPreviewChars: config.rag.governanceTextPreviewChars
  });

  if (prepared.governanceErrors.length > 0) {
    throw new Error(`RAG governance validation failed for ${prepared.governanceErrors.length} documents.`);
  }

  const embeddingProvider = new GeminiEmbeddingProvider({
    apiKey: config.rag.geminiApiKey,
    model: config.rag.embeddingModel,
    outputDimension: config.rag.qdrantVectorSize,
    ...(config.rag.geminiEndpoint ? { endpoint: config.rag.geminiEndpoint } : {})
  });
  const embedDelayMs = readNonNegativeIntegerFromEnv("RAG_INGEST_EMBED_DELAY_MS", DEFAULT_EMBED_DELAY_MS);
  const maxEmbedRetries = readPositiveIntegerFromEnv("RAG_INGEST_MAX_RETRIES", DEFAULT_MAX_EMBED_RETRIES);
  const embeddedChunks = [];
  const errors: string[] = [];

  for (const chunk of prepared.chunks) {
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

  if (errors.length > 0) {
    throw new Error(`Embedding failed for ${errors.length} chunks.`);
  }

  if (embeddedChunks.length !== prepared.chunks.length) {
    throw new Error(`Embedded chunk count ${embeddedChunks.length} does not match expected ${prepared.chunks.length}.`);
  }

  await vectorStore.upsertChunks(embeddedChunks);

  const indexedChunkCount = await vectorStore.countNamedCollectionPoints(targetCollection);
  if (indexedChunkCount !== prepared.chunks.length) {
    throw new Error(`Indexed point count ${indexedChunkCount} does not match expected ${prepared.chunks.length}.`);
  }

  console.log(JSON.stringify({
    collectionName: targetCollection,
    documentCount: prepared.documentCount,
    expectedChunkCount: prepared.chunks.length,
    indexedChunkCount,
    embeddingModel: config.rag.embeddingModel,
    vectorSize: config.rag.qdrantVectorSize,
    errorsCount: 0
  }, null, 2));
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

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function readNonNegativeIntegerFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return parsed;
}

function readPositiveIntegerFromEnv(name: string, fallback: number): number {
  const parsed = readNonNegativeIntegerFromEnv(name, fallback);
  if (parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: safeErrorMessage(error)
  }));
  process.exitCode = 1;
});

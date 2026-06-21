import { fileURLToPath } from "node:url";
import path from "node:path";
import { GeminiEmbeddingProvider } from "@babyloop/ai-core";
import { readApiRuntimeConfig } from "../config/env.js";
import { chunkRagDocument } from "../services/rag-chunking.service.js";
import { loadRagDocuments } from "../services/rag-markdown-loader.service.js";
import { QdrantVectorStore } from "../services/rag-qdrant-vector-store.service.js";

async function main(): Promise<void> {
  const config = readApiRuntimeConfig();

  if (!config.rag.enabled) {
    throw new Error("RAG_ENABLED=true olmadan ingestion çalıştırılamaz.");
  }

  const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
  const docsRoot = path.join(repoRoot, "docs", "rag");
  const documents = await loadRagDocuments(docsRoot);
  const chunks = documents.flatMap((document) => chunkRagDocument(document));
  const embeddingProvider = new GeminiEmbeddingProvider({
    apiKey: config.rag.geminiApiKey,
    model: config.rag.embeddingModel,
    ...(config.rag.geminiEndpoint ? { endpoint: config.rag.geminiEndpoint } : {})
  });
  const vectorStore = new QdrantVectorStore({
    collectionName: config.rag.qdrantCollection,
    ...(config.rag.qdrantApiKey ? { apiKey: config.rag.qdrantApiKey } : {}),
    url: config.rag.qdrantUrl,
    vectorSize: config.rag.qdrantVectorSize
  });

  await vectorStore.ensureCollection();

  const embeddedChunks = [];
  const errors: string[] = [];

  for (const chunk of chunks) {
    try {
      const embedding = await embeddingProvider.embedText({
        text: chunk.text
      });

      embeddedChunks.push({
        ...chunk,
        embedding: embedding.embedding
      });
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

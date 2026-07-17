import { readApiRuntimeConfig } from "../config/env.js";
import {
  createBlueGreenVectorStore,
  prepareRagIndex,
  validateCandidateCollection
} from "../services/rag-index-deployment.service.js";

async function main(): Promise<void> {
  const targetCollection = readRequiredEnv("RAG_INDEX_TARGET_COLLECTION");
  const config = readApiRuntimeConfig();

  if (!config.rag.enabled) {
    throw new Error("RAG_ENABLED=true olmadan candidate index validation çalıştırılamaz.");
  }

  const prepared = await prepareRagIndex({
    embeddingModel: config.rag.embeddingModel,
    indexVersion: targetCollection,
    textPreviewChars: config.rag.governanceTextPreviewChars
  });
  const vectorStore = createBlueGreenVectorStore(config.rag, targetCollection);
  const summary = await validateCandidateCollection({
    collectionName: targetCollection,
    expectedChunkCount: prepared.chunks.length,
    expectedEmbeddingModel: config.rag.embeddingModel,
    expectedVectorSize: config.rag.qdrantVectorSize,
    vectorStore
  });

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exitCode = 1;
  }
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

main().catch((error) => {
  console.error(JSON.stringify({
    passed: false,
    errors: [safeErrorMessage(error)]
  }));
  process.exitCode = 1;
});

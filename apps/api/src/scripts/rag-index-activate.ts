import { readApiRuntimeConfig } from "../config/env.js";
import {
  assertActivationConfirmation,
  assertCandidateCollectionName,
  createBlueGreenVectorStore,
  prepareRagIndex,
  RAG_ACTIVE_ALIAS_DEFAULT,
  runRagLiveAcceptance,
  validateCandidateCollection
} from "../services/rag-index-deployment.service.js";

async function main(): Promise<void> {
  assertActivationConfirmation(process.env);

  const targetCollection = readRequiredEnv("RAG_INDEX_TARGET_COLLECTION");
  const aliasName = process.env.RAG_INDEX_ALIAS?.trim() || RAG_ACTIVE_ALIAS_DEFAULT;
  const config = readApiRuntimeConfig();

  if (!config.rag.enabled) {
    throw new Error("RAG_ENABLED=true olmadan index activation çalıştırılamaz.");
  }

  const vectorStore = createBlueGreenVectorStore(config.rag, targetCollection);
  const aliases = await vectorStore.listAliases();
  assertCandidateCollectionName(targetCollection, {
    aliases,
    ...(config.rag.qdrantCollection === aliasName ? {} : { runtimeCollection: config.rag.qdrantCollection })
  });

  const prepared = await prepareRagIndex({
    embeddingModel: config.rag.embeddingModel,
    indexVersion: targetCollection,
    textPreviewChars: config.rag.governanceTextPreviewChars
  });
  const validation = await validateCandidateCollection({
    collectionName: targetCollection,
    expectedChunkCount: prepared.chunks.length,
    expectedEmbeddingModel: config.rag.embeddingModel,
    expectedVectorSize: config.rag.qdrantVectorSize,
    vectorStore
  });

  if (!validation.passed) {
    throw new Error(`Candidate validation failed: ${validation.errors.join("; ")}`);
  }

  const acceptance = await runRagLiveAcceptance({
    collectionName: targetCollection,
    config: config.rag
  });

  if (!acceptance.passed) {
    const failedIds = acceptance.cases.filter((testCase) => !testCase.passed).map((testCase) => testCase.id);
    throw new Error(`Live acceptance failed: ${failedIds.join(", ")}`);
  }

  const previousTarget = await vectorStore.getAliasTarget(aliasName);
  await vectorStore.switchAliasAtomically(aliasName, targetCollection);

  const activeTarget = await vectorStore.getAliasTarget(aliasName);
  if (activeTarget !== targetCollection) {
    throw new Error(`Alias verification failed. ${aliasName} points to ${activeTarget ?? "none"}.`);
  }

  console.log(JSON.stringify({
    activated: true,
    aliasName,
    targetCollection,
    previousTarget,
    rollbackCommand: previousTarget
      ? `RAG_INDEX_ROLLBACK_ENABLED=true RAG_INDEX_ROLLBACK_CONFIRM=ROLLBACK_RAG_INDEX RAG_INDEX_ROLLBACK_COLLECTION=${previousTarget} RAG_INDEX_ALIAS=${aliasName} pnpm rag:index:rollback`
      : null
  }, null, 2));
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
    activated: false,
    error: safeErrorMessage(error)
  }));
  process.exitCode = 1;
});

import { readApiRuntimeConfig } from "../config/env.js";
import {
  assertRollbackConfirmation,
  createBlueGreenVectorStore,
  RAG_ACTIVE_ALIAS_DEFAULT
} from "../services/rag-index-deployment.service.js";

async function main(): Promise<void> {
  assertRollbackConfirmation(process.env);

  const rollbackCollection = readRequiredEnv("RAG_INDEX_ROLLBACK_COLLECTION");
  const aliasName = process.env.RAG_INDEX_ALIAS?.trim() || RAG_ACTIVE_ALIAS_DEFAULT;
  const config = readApiRuntimeConfig();

  if (!config.rag.enabled) {
    throw new Error("RAG_ENABLED=true olmadan index rollback çalıştırılamaz.");
  }

  const vectorStore = createBlueGreenVectorStore(config.rag, rollbackCollection);

  if (!(await vectorStore.collectionExists(rollbackCollection))) {
    throw new Error("Rollback target collection does not exist.");
  }

  const info = await vectorStore.getNamedCollectionInfo(rollbackCollection);

  if (info.status !== "green") {
    throw new Error(`Rollback target status is ${info.status}.`);
  }

  if (info.vectorSize !== config.rag.qdrantVectorSize) {
    throw new Error(`Rollback target vector size ${info.vectorSize} does not match expected ${config.rag.qdrantVectorSize}.`);
  }

  if (info.pointsCount <= 0) {
    throw new Error("Rollback target has no points.");
  }

  const previousTarget = await vectorStore.getAliasTarget(aliasName);
  await vectorStore.switchAliasAtomically(aliasName, rollbackCollection);

  const activeTarget = await vectorStore.getAliasTarget(aliasName);
  if (activeTarget !== rollbackCollection) {
    throw new Error(`Alias verification failed. ${aliasName} points to ${activeTarget ?? "none"}.`);
  }

  console.log(JSON.stringify({
    rolledBack: true,
    aliasName,
    targetCollection: rollbackCollection,
    previousTarget,
    pointsCount: info.pointsCount
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
    rolledBack: false,
    error: safeErrorMessage(error)
  }));
  process.exitCode = 1;
});

import { readApiRuntimeConfig } from "../config/env.js";
import { runRagLiveAcceptance } from "../services/rag-index-deployment.service.js";

async function main(): Promise<void> {
  const targetCollection = readRequiredEnv("RAG_ACCEPTANCE_COLLECTION");
  const config = readApiRuntimeConfig();

  if (!config.rag.enabled) {
    throw new Error("RAG_ENABLED=true olmadan live acceptance çalıştırılamaz.");
  }

  const summary = await runRagLiveAcceptance({
    collectionName: targetCollection,
    config: config.rag
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

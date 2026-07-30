import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const MIGRATION_EVIDENCE_POLL_ATTEMPTS = 13;
export const MIGRATION_EVIDENCE_POLL_DELAY_MS = 5_000;

export async function readExpectedMigrationHead(root = process.cwd()) {
  const migrationsFolder = resolve(root, "packages/database/drizzle");
  const journal = JSON.parse(await readFile(resolve(migrationsFolder, "meta/_journal.json"), "utf8"));
  const entry = journal.entries?.at(-1);
  if (!entry || typeof entry.tag !== "string") throw new Error("Migration journal final entry is missing.");
  const contents = await readFile(resolve(migrationsFolder, `${entry.tag}.sql`));
  return {
    expectedMigrationTag: entry.tag,
    expectedMigrationHash: createHash("sha256").update(contents).digest("hex")
  };
}

export function readExecutionName(executionResult) {
  const name = executionResult?.metadata?.name;
  if (typeof name !== "string" || !name.trim()) throw new Error("Migration execution name is missing.");
  return name.split("/").at(-1);
}

export function verifyMigrationEvidence(entries, expected, executionName) {
  const evidence = entries.find((entry) => (
    entry?.jsonPayload?.event === "migration_head_verified" &&
    entry?.jsonPayload?.ok === true &&
    entry?.labels?.["run.googleapis.com/execution_name"] === executionName
  ))?.jsonPayload;

  if (!evidence) throw new Error(`Migration head verification evidence is missing for ${executionName}.`);
  if (evidence.expectedMigrationTag !== expected.expectedMigrationTag) {
    throw new Error("Migration verification tag does not match the repository journal head.");
  }
  if (
    evidence.expectedMigrationHash !== expected.expectedMigrationHash ||
    evidence.actualMigrationHash !== expected.expectedMigrationHash
  ) {
    throw new Error("Migration verification hash does not match the repository migration head.");
  }
  if (!Array.isArray(evidence.verifiedTables) || evidence.verifiedTables.length === 0) {
    throw new Error("Migration verification did not report schema contract tables.");
  }

  return {
    expectedMigrationTag: evidence.expectedMigrationTag,
    expectedMigrationHash: evidence.expectedMigrationHash,
    actualMigrationHash: evidence.actualMigrationHash,
    verifiedTables: evidence.verifiedTables,
    verifiedAt: evidence.verifiedAt
  };
}

export async function pollForMigrationEvidence({
  readEntries,
  expected,
  executionName,
  attempts = MIGRATION_EVIDENCE_POLL_ATTEMPTS,
  delayMs = MIGRATION_EVIDENCE_POLL_DELAY_MS,
  sleep = (durationMs) => new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs)),
}) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error("Migration evidence polling attempts must be a positive integer.");
  }
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error("Migration evidence polling delay must be a non-negative integer.");
  }

  let lastVerificationError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const entries = await readEntries();

    try {
      return verifyMigrationEvidence(entries, expected, executionName);
    } catch (error) {
      lastVerificationError = error;
      if (attempt === attempts - 1) break;
      await sleep(delayMs);
    }
  }

  throw lastVerificationError ?? new Error(`Migration verification timed out for ${executionName}.`);
}

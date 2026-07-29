import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { readJsonReceipt } from "./deployment-lib.mjs";

export const RUNTIME_IDENTIFIER_KEYS = Object.freeze([
  "RAG_QDRANT_URL",
  "RAG_QDRANT_COLLECTION",
  "RAG_REDIS_KEY_PREFIX",
  "NOTIFICATION_PROVIDER_WORKER_ID",
  "CHILD_REMINDER_WORKER_ID",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "IMAGE_STORAGE_PUBLIC_BASE_URL",
  "RESEND_API_BASE_URL",
  "EXPO_PUSH_API_BASE_URL"
]);

const WORKER_IDENTIFIER_KEYS = new Set([
  "NOTIFICATION_PROVIDER_WORKER_ID",
  "CHILD_REMINDER_WORKER_ID"
]);
const MIGRATION_CONFIRMATION = "ALLOW_PROVIDER_IDENTIFIER_MIGRATION_PRODUCTION";

export async function verifyRuntimeIdentifierContinuity({
  audit,
  inventoryPath = process.env.CURRENT_RUNTIME_IDENTIFIER_INVENTORY_PATH,
  migrationConfirmation = process.env.PROVIDER_IDENTIFIER_MIGRATION_CONFIRM,
  workerEvidencePath = process.env.WORKER_IDENTIFIER_MIGRATION_EVIDENCE_PATH
}) {
  if (audit?.environment !== "production" || audit?.values?.DEPLOY_TOPOLOGY !== "single_environment") {
    throw new Error("Runtime identifier continuity requires the production single_environment audit.");
  }
  if (!String(inventoryPath || "").trim()) {
    throw new Error("CURRENT_RUNTIME_IDENTIFIER_INVENTORY_PATH is required for production identifier continuity.");
  }
  const resolvedInventoryPath = resolve(inventoryPath);
  const inventory = await readJsonReceipt(resolvedInventoryPath);
  if (
    inventory?.schemaVersion !== 1
    || inventory.kind !== "current_runtime_identifier_inventory"
    || inventory.environment !== "production"
    || inventory.topology !== "single_environment"
    || !inventory.identifiers
    || typeof inventory.identifiers !== "object"
  ) {
    throw new Error("Current runtime identifier inventory is invalid or belongs to another environment/topology.");
  }
  const unexpectedIdentifierKeys = Object.keys(inventory.identifiers)
    .filter((key) => !RUNTIME_IDENTIFIER_KEYS.includes(key));
  if (unexpectedIdentifierKeys.length > 0) {
    throw new Error(`Current runtime inventory contains unsupported identifier keys: ${unexpectedIdentifierKeys.join(", ")}.`);
  }

  const changedKeys = [];
  for (const key of RUNTIME_IDENTIFIER_KEYS) {
    const proposed = String(audit.values[key] || "").trim();
    const current = String(inventory.identifiers[key] || "").trim();
    if (!current) throw new Error(`Current runtime identifier inventory is missing ${key}.`);
    assertNonSecretIdentifier(key, current);
    assertNonSecretIdentifier(key, proposed);
    if (current !== proposed) changedKeys.push(key);
  }

  const workerChangedKeys = changedKeys.filter((key) => WORKER_IDENTIFIER_KEYS.has(key));
  if (changedKeys.length > 0 && migrationConfirmation !== MIGRATION_CONFIRMATION) {
    throw new Error(
      `Runtime identifier changes require PROVIDER_IDENTIFIER_MIGRATION_CONFIRM=${MIGRATION_CONFIRMATION}; changed keys: ${changedKeys.join(", ")}.`
    );
  }
  let workerMigrationEvidenceVerified = false;
  if (workerChangedKeys.length > 0) {
    if (!String(workerEvidencePath || "").trim()) {
      throw new Error("Worker identifier changes require controlled worker verification evidence before smoke.");
    }
    const evidence = await readJsonReceipt(workerEvidencePath);
    if (
      evidence?.schemaVersion !== 1
      || evidence.kind !== "worker_identifier_migration_evidence"
      || evidence.environment !== "production"
      || evidence.status !== "passed"
      || !workerChangedKeys.every((key) => evidence.changedKeys?.includes(key))
    ) {
      throw new Error("Worker identifier migration evidence is invalid or incomplete.");
    }
    workerMigrationEvidenceVerified = true;
  }

  return {
    verified: true,
    environment: "production",
    topology: "single_environment",
    inventoryFile: basename(resolvedInventoryPath),
    inventorySha256: await fileSha256(resolvedInventoryPath),
    changedKeys,
    migrationConfirmed: changedKeys.length > 0,
    workerMigrationEvidenceVerified
  };
}

function assertNonSecretIdentifier(key, value) {
  if (!value) throw new Error(`${key} must be present in the audited production runtime.`);
  if (/^(?:redis|rediss|postgres|postgresql):\/\//iu.test(value) || /:\/\/[^/\s]+:[^/@\s]+@/u.test(value)) {
    throw new Error(`${key} inventory value must be a non-secret identifier without embedded credentials.`);
  }
  if (/(?:URL|ENDPOINT|PUBLIC_BASE_URL)$/u.test(key)) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${key} must be a valid non-secret URL identifier.`);
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error(`${key} must not contain credentials, query parameters, or fragments.`);
    }
  }
}

async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

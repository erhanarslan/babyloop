import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const RELEASE_MANIFEST_SCHEMA_VERSION = 1;

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function isDigestPinnedImage(value) {
  return typeof value === "string" && /^[^\s]+@sha256:[a-f0-9]{64}$/u.test(value);
}

export function assertReleaseManifest(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Release manifest must be a JSON object.");
  }
  if (value.schemaVersion !== RELEASE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported release manifest schema version: ${value.schemaVersion ?? "missing"}.`);
  }
  for (const key of ["createdAt", "environment", "gitSha", "releaseId"]) {
    if (typeof value[key] !== "string" || !value[key]) {
      throw new Error(`Release manifest is missing ${key}.`);
    }
  }
  if (!value.services || typeof value.services !== "object") {
    throw new Error("Release manifest services are missing.");
  }
  for (const service of ["api", "backoffice", "web"]) {
    if (!value.services[service] || typeof value.services[service].image !== "string") {
      throw new Error(`Release manifest is missing ${service} image.`);
    }
  }
  if (!value.database || typeof value.database.migrationHead !== "string") {
    throw new Error("Release manifest database contract is missing.");
  }
  return value;
}

export async function readReleaseManifest(path, options = {}) {
  const content = await readFile(path, "utf8");
  const manifest = assertReleaseManifest(JSON.parse(content));
  if (options.requireChecksum) {
    const checksumContent = (await readFile(`${path}.sha256`, "utf8")).trim();
    const expected = checksumContent.split(/\s+/u)[0];
    const actual = sha256Text(content);
    if (expected !== actual) {
      throw new Error(`Release manifest checksum mismatch: ${path}`);
    }
  }
  return { content, manifest };
}

export function buildRollbackPlan({ current, target, allowForwardSchema = false }) {
  assertReleaseManifest(current);
  assertReleaseManifest(target);

  if (current.environment !== target.environment) {
    throw new Error("Rollback manifests must target the same environment.");
  }
  if (Date.parse(target.createdAt) >= Date.parse(current.createdAt)) {
    throw new Error("Rollback target must be older than the current release.");
  }
  if (current.releaseId === target.releaseId || current.gitSha === target.gitSha) {
    throw new Error("Rollback target must differ from the current release.");
  }

  for (const service of ["api", "backoffice", "web"]) {
    if (!isDigestPinnedImage(target.services[service].image)) {
      throw new Error(`Rollback target ${service} image must be pinned by sha256 digest.`);
    }
  }

  const migrationChanged = current.database.migrationHead !== target.database.migrationHead;
  if (migrationChanged && !current.database.forwardCompatibleWithPrevious) {
    throw new Error("Current database migration is not declared forward-compatible with the previous release.");
  }
  if (migrationChanged && !allowForwardSchema) {
    throw new Error("Rollback keeps the current schema. Set ROLLBACK_ALLOW_FORWARD_SCHEMA=true after compatibility review.");
  }

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    database: {
      action: "keep_current_schema",
      currentMigrationHead: current.database.migrationHead,
      targetCodeMigrationHead: target.database.migrationHead,
      warning: migrationChanged
        ? "Code rollback will run against the current forward-compatible database schema. No down migration is executed."
        : "Database schema is unchanged."
    },
    environment: current.environment,
    fromReleaseId: current.releaseId,
    services: {
      api: { image: target.services.api.image },
      backoffice: { image: target.services.backoffice.image },
      web: { image: target.services.web.image }
    },
    targetGitSha: target.gitSha,
    toReleaseId: target.releaseId,
    verification: [
      "Run /health/live and /health/ready.",
      "Confirm protected metrics and worker heartbeats.",
      "Run beta critical smoke against the rolled-back release.",
      "Record the manual go/no-go decision."
    ]
  };
}

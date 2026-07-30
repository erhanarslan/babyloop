import { createDatabaseClient } from "@babyloop/database";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  resolveMigrationsFolder,
  verifyDatabaseMigrationHead,
} from "../services/database-migration-head.service.js";

const environment = (process.env.MIGRATION_ENVIRONMENT ?? "local").trim().toLowerCase();
const allowedEnvironments = new Set(["local", "staging", "production"]);
if (!allowedEnvironments.has(environment)) {
  throw new Error("MIGRATION_ENVIRONMENT must be local, staging, or production.");
}
if (environment !== "local") {
  const expected = `APPLY_${environment.toUpperCase()}`;
  if (process.env.MIGRATION_CONFIRM !== expected) {
    throw new Error(`Migration requires MIGRATION_CONFIRM=${expected}.`);
  }
}

const migrationsFolder = resolveMigrationsFolder();
const client = createDatabaseClient({
  pool: {
    application_name: `babyloop-migration-${environment}`,
    max: 1,
    statement_timeout: readPositiveInteger(process.env.MIGRATION_STATEMENT_TIMEOUT_MS, 120_000)
  }
});

try {
  await client.pool.query("select pg_advisory_lock($1, $2)", [64120, 15015]);
  await migrate(client.db, { migrationsFolder });
  const verification = await verifyDatabaseMigrationHead(client.db, { migrationsFolder });
  process.stdout.write(`${JSON.stringify({
    environment,
    migrationsFolder,
    event: "migration_head_verified",
    expectedMigrationTag: verification.tag,
    expectedMigrationHash: verification.hash,
    actualMigrationHash: verification.actualMigrationHash,
    verifiedTables: verification.verifiedTables,
    verifiedAt: verification.verifiedAt,
    ok: true,
    completedAt: new Date().toISOString()
  })}\n`);
} finally {
  await client.pool.query("select pg_advisory_unlock($1, $2)", [64120, 15015]).catch(() => undefined);
  await client.close();
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

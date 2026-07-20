import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabaseClient } from "@babyloop/database";
import { migrate } from "drizzle-orm/node-postgres/migrator";

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
  process.stdout.write(`${JSON.stringify({
    environment,
    migrationsFolder,
    ok: true,
    completedAt: new Date().toISOString()
  }, null, 2)}\n`);
} finally {
  await client.pool.query("select pg_advisory_unlock($1, $2)", [64120, 15015]).catch(() => undefined);
  await client.close();
}

function resolveMigrationsFolder(): string {
  const configured = process.env.DATABASE_MIGRATIONS_DIR?.trim();
  if (configured) {
    const path = resolve(configured);
    if (!existsSync(path)) throw new Error(`DATABASE_MIGRATIONS_DIR does not exist: ${path}`);
    return path;
  }

  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), "migrations"),
    resolve(process.cwd(), "packages/database/drizzle"),
    resolve(process.cwd(), "../../packages/database/drizzle"),
    resolve(scriptDirectory, "../../../../packages/database/drizzle")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `No database migrations directory was found. Checked: ${candidates.join(", ")}`
  );
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

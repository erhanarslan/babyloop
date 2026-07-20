import { createDatabaseClient } from "@babyloop/database";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function getTestDatabaseUrl(): string {
  const databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for API integration tests.");
  }

  if (process.env.DATABASE_URL && process.env.DATABASE_URL === databaseUrl) {
    throw new Error("TEST_DATABASE_URL must not be the same value as DATABASE_URL.");
  }

  return databaseUrl;
}

export async function resetTestDatabase(): Promise<void> {
  const databaseUrl = getTestDatabaseUrl();
  const client = createDatabaseClient({
    databaseUrl,
    pool: {
      connectionTimeoutMillis: 10_000,
      max: 1
    }
  });

  try {
    await client.pool.query("SET lock_timeout = '15s'; SET statement_timeout = '60s';");
    await client.pool.query(
      "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
    );
    await migrate(client.db, {
      migrationsFolder: resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../packages/database/drizzle"
      )
    });
  } finally {
    await client.close();
  }
}

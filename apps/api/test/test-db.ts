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
  const resetClient = createDatabaseClient({ databaseUrl });

  try {
    await resetClient.pool.query(
      "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
    );
  } finally {
    await resetClient.close();
  }

  const migrationClient = createDatabaseClient({ databaseUrl });

  try {
    await migrate(migrationClient.db, {
      migrationsFolder: resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../../../packages/database/drizzle"
      )
    });
  } finally {
    await migrationClient.close();
  }
}

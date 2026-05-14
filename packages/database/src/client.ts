import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { schema } from "./schema/index.js";

export type Database = NodePgDatabase<typeof schema>;

export type DatabaseClient = {
  db: Database;
  pool: Pool;
  close: () => Promise<void>;
};

export type DatabaseClientOptions = {
  databaseUrl?: string;
  pool?: Omit<PoolConfig, "connectionString">;
};

let singletonClient: DatabaseClient | undefined;

export function createDatabaseClient(options: DatabaseClientOptions = {}): DatabaseClient {
  const connectionString = options.databaseUrl ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create the database client.");
  }

  const pool = new Pool({
    ...options.pool,
    connectionString
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
    close: () => pool.end()
  };
}

export function getDatabaseClient(): DatabaseClient {
  singletonClient ??= createDatabaseClient();

  return singletonClient;
}

export async function closeDatabaseClient(): Promise<void> {
  if (!singletonClient) {
    return;
  }

  await singletonClient.close();
  singletonClient = undefined;
}

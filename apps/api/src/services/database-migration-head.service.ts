import type { Database } from "@babyloop/database";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";

const REQUIRED_SCHEMA_COLUMNS = [
  "legal_acceptances.user_id",
  "legal_acceptances.document_type",
  "legal_acceptances.document_version",
  "legal_acceptances.source",
  "users.is_demo_system_account",
  "users.login_disabled",
  "users.provider_delivery_disabled",
  "profiles.is_demo_system_profile",
  "listings.is_demo",
  "listings.demo_seed_key",
  "listings.demo_seed_version",
] as const;

export type ExpectedMigrationHead = {
  tag: string;
  hash: string;
  migrationsFolder: string;
};

export type VerifiedMigrationHead = ExpectedMigrationHead & {
  actualMigrationHash: string;
  verifiedTables: string[];
  verifiedAt: string;
};

export async function readExpectedMigrationHead(
  configuredFolder?: string,
): Promise<ExpectedMigrationHead> {
  const migrationsFolder = resolveMigrationsFolder(configuredFolder);
  const journal = JSON.parse(
    await readFile(resolve(migrationsFolder, "meta/_journal.json"), "utf8"),
  ) as { entries?: Array<{ tag?: unknown }> };
  const finalEntry = journal.entries?.at(-1);

  if (!finalEntry || typeof finalEntry.tag !== "string" || !finalEntry.tag.trim()) {
    throw new Error("Migration journal does not contain a valid final entry.");
  }

  const tag = finalEntry.tag.trim();
  const sqlContents = await readFile(resolve(migrationsFolder, `${tag}.sql`));

  return {
    tag,
    hash: createHash("sha256").update(sqlContents).digest("hex"),
    migrationsFolder,
  };
}

export async function verifyDatabaseMigrationHead(
  db: Database,
  options: { migrationsFolder?: string } = {},
): Promise<VerifiedMigrationHead> {
  const expected = await readExpectedMigrationHead(options.migrationsFolder);
  const migrationResult = await db.execute(sql`
    select hash
    from drizzle.__drizzle_migrations
    order by created_at desc
    limit 1
  `) as unknown as { rows: Array<{ hash: string }> };
  const actualMigrationHash = migrationResult.rows[0]?.hash;

  if (!actualMigrationHash || actualMigrationHash !== expected.hash) {
    throw new Error("DATABASE_MIGRATION_HEAD_MISMATCH");
  }

  const schemaResult = await db.execute(sql`
    select table_name || '.' || column_name as key
    from information_schema.columns
    where table_schema = 'public'
      and (table_name, column_name) in (
        ('legal_acceptances', 'user_id'),
        ('legal_acceptances', 'document_type'),
        ('legal_acceptances', 'document_version'),
        ('legal_acceptances', 'source'),
        ('users', 'is_demo_system_account'),
        ('users', 'login_disabled'),
        ('users', 'provider_delivery_disabled'),
        ('profiles', 'is_demo_system_profile'),
        ('listings', 'is_demo'),
        ('listings', 'demo_seed_key'),
        ('listings', 'demo_seed_version')
      )
  `) as unknown as { rows: Array<{ key: string }> };
  const foundColumns = new Set(schemaResult.rows.map((row) => row.key));
  const missingColumns = REQUIRED_SCHEMA_COLUMNS.filter((column) => !foundColumns.has(column));

  if (missingColumns.length > 0) {
    throw new Error(`DATABASE_SCHEMA_CONTRACT_MISSING:${missingColumns.join(",")}`);
  }

  return {
    ...expected,
    actualMigrationHash,
    verifiedAt: new Date().toISOString(),
    verifiedTables: ["legal_acceptances", "listings", "profiles", "users"],
  };
}

export function resolveMigrationsFolder(configuredFolder?: string): string {
  const configured = configuredFolder?.trim() || process.env.DATABASE_MIGRATIONS_DIR?.trim();
  const candidates = configured
    ? [resolve(configured)]
    : [
        resolve(process.cwd(), "migrations"),
        resolve(process.cwd(), "packages/database/drizzle"),
        resolve(process.cwd(), "../../packages/database/drizzle"),
      ];

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "meta/_journal.json"))) {
      return candidate;
    }
  }

  throw new Error("DATABASE_MIGRATIONS_DIRECTORY_NOT_FOUND");
}

import { createDatabaseClient } from "@babyloop/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTestDatabaseUrl, resetTestDatabase } from "./helpers/db.js";

describe("fresh database migration chain", () => {
  const client = createDatabaseClient({ databaseUrl: getTestDatabaseUrl() });

  beforeAll(async () => {
    await resetTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await client.close();
  });

  it("creates the complete listing_status enum without unsafe same-transaction enum usage", async () => {
    const result = await client.pool.query<{ enumlabel: string }>(`
      select enumlabel
      from pg_enum
      inner join pg_type on pg_type.oid = pg_enum.enumtypid
      inner join pg_namespace on pg_namespace.oid = pg_type.typnamespace
      where pg_namespace.nspname = 'public'
        and pg_type.typname = 'listing_status'
      order by pg_enum.enumsortorder
    `);

    expect(result.rows.map((row) => row.enumlabel)).toEqual([
      "draft",
      "active",
      "reserved",
      "sold",
      "archived"
    ]);
  });
});

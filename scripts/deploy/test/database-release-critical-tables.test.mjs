import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DATABASE_RELEASE_CRITICAL_TABLES,
} from "../../ops/database-release-contract.mjs";

test("database postflight critical tables match the checked-in auth schema", async () => {
  assert.deepEqual(
    [...DATABASE_RELEASE_CRITICAL_TABLES],
    [
      "users",
      "profiles",
      "sessions",
      "listings",
      "listing_images",
    ],
  );

  const [
    safetySource,
    schemaSource,
    authMigrationSource,
  ] = await Promise.all([
    readFile(
      "scripts/ops/database-release-safety.mjs",
      "utf8",
    ),
    readFile(
      "packages/database/src/schema/index.ts",
      "utf8",
    ),
    readFile(
      "packages/database/drizzle/0005_cloudy_tag.sql",
      "utf8",
    ),
  ]);

  assert.doesNotMatch(
    safetySource,
    /auth_sessions/u,
  );

  assert.match(
    safetySource,
    /for \(const table of DATABASE_RELEASE_CRITICAL_TABLES\)/u,
  );

  assert.match(
    schemaSource,
    /export const sessions = pgTable\(\s*"sessions"/u,
  );

  assert.match(
    authMigrationSource,
    /CREATE TABLE "sessions"/u,
  );
});

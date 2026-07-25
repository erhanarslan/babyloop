#!/usr/bin/env node
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { timestampForFile, writeJsonReceipt } from "../deploy/deployment-lib.mjs";
import { formatDatabaseError } from "./database-error-format.mjs";

const requireFromDatabase = createRequire(resolve("packages/database/package.json"));
const { Client } = requireFromDatabase("pg");
const phase = readArg("--phase") || "preflight";
const environment = String(process.env.MIGRATION_ENVIRONMENT || "").trim().toLowerCase();
const databaseUrl = required("DATABASE_URL");
const expectedName = required("EXPECTED_DATABASE_NAME");
const allowedPhases = new Set(["preflight", "postflight"]);

if (!allowedPhases.has(phase)) fail("--phase must be preflight or postflight.");
if (!["staging", "production"].includes(environment)) fail("MIGRATION_ENVIRONMENT must be staging or production.");
assertDifferentDatabaseUrls();
assertQdrantCredentialIsolation();

const parsedUrl = new URL(databaseUrl);
const urlDatabaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/u, ""));
if (urlDatabaseName !== expectedName) {
  fail(`DATABASE_URL database name ${urlDatabaseName || "<empty>"} does not match EXPECTED_DATABASE_NAME.`);
}
if (/(^|[_-])(postgres|template0|template1)([_-]|$)/iu.test(expectedName)) {
  fail(`Refusing release operations against reserved database ${expectedName}.`);
}
if (!expectedName.toLowerCase().includes(environment)) {
  fail(`EXPECTED_DATABASE_NAME must include ${environment} to prove environment isolation.`);
}

const client = new Client({
  connectionString: databaseUrl,
  application_name: `babyloop-release-${phase}-${environment}`,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000
});

try {
  await client.connect();
  const identity = (await client.query(`
    select current_database() as database_name,
           current_user as database_user,
           current_schema() as current_schema,
           inet_server_addr()::text as server_address
  `)).rows[0];
  if (identity.database_name !== expectedName) fail("Connected database identity does not match EXPECTED_DATABASE_NAME.");

  const journal = await migrationJournalState(client);
  const checkedIn = await checkedInMigrationState();
  const schema = await schemaState(client);
  const destructive = await destructiveMigrationFindings(
    checkedIn.files.slice(journal.appliedCount)
  );

  if (phase === "preflight") {
    if (journal.appliedCount > checkedIn.count) {
      fail("Database migration journal is ahead of the checked-in migration chain.");
    }
    if (destructive.length > 0) {
      const expected = `ALLOW_DESTRUCTIVE_${environment.toUpperCase()}`;
      if (process.env.MIGRATION_ALLOW_DESTRUCTIVE_CONFIRM !== expected) {
        fail(`Potentially destructive migration SQL found; MIGRATION_ALLOW_DESTRUCTIVE_CONFIRM=${expected} is required after review.`);
      }
    }
  } else {
    if (journal.appliedCount !== checkedIn.count) {
      fail(`Post-migration journal count ${journal.appliedCount} does not match checked-in count ${checkedIn.count}.`);
    }
    for (const table of ["profiles", "listings", "listing_images", "auth_sessions"]) {
      if (!schema.criticalTables.includes(table)) fail(`Critical table ${table} is missing after migration.`);
    }
    for (const label of ["pending", "approved", "needs_review", "rejected"]) {
      if (!schema.enumLabels.includes(label)) {
        fail(`listing_image_review_status enum is missing ${label} after migration.`);
      }
    }
  }

  const createdAt = new Date().toISOString();
  const outputPath = resolve(
    process.env.DATABASE_RELEASE_EVIDENCE_PATH
      || `.release/evidence/${environment}-database-${phase}-${timestampForFile(new Date(createdAt))}.json`
  );
  const receipt = await writeJsonReceipt(outputPath, {
    schemaVersion: 1,
    kind: `database_release_${phase}`,
    status: "passed",
    createdAt,
    environment,
    database: {
      name: identity.database_name,
      user: identity.database_user,
      schema: identity.current_schema,
      serverAddressPresent: Boolean(identity.server_address)
    },
    migrations: {
      appliedCount: journal.appliedCount,
      checkedInCount: checkedIn.count,
      pendingCount: Math.max(0, checkedIn.count - journal.appliedCount),
      checkedInHead: checkedIn.head,
      destructiveFindings: destructive
    },
    schema
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    phase,
    environment,
    databaseName: identity.database_name,
    appliedMigrations: journal.appliedCount,
    checkedInMigrations: checkedIn.count,
    evidencePath: receipt.path,
    checksum: receipt.checksum
  }, null, 2)}\n`);
} catch (error) {
  fail(formatDatabaseError(error, databaseUrl));
} finally {
  await client.end().catch(() => undefined);
}

async function migrationJournalState(connection) {
  const exists = await connection.query("select to_regclass('drizzle.__drizzle_migrations')::text as name");
  if (!exists.rows[0]?.name) return { appliedCount: 0 };
  const result = await connection.query("select count(*)::integer as count from drizzle.__drizzle_migrations");
  return { appliedCount: result.rows[0].count };
}

async function checkedInMigrationState() {
  const journal = JSON.parse(await readFile("packages/database/drizzle/meta/_journal.json", "utf8"));
  const entries = Array.isArray(journal.entries) ? journal.entries : [];
  return {
    count: entries.length,
    head: entries.at(-1)?.tag || "none",
    files: entries.map((entry) => `${entry.tag}.sql`)
  };
}

async function destructiveMigrationFindings(files) {
  const findings = [];
  const destructive = /\b(DROP\s+(TABLE|COLUMN|TYPE|SCHEMA|INDEX)|TRUNCATE\s+TABLE|ALTER\s+TABLE[\s\S]{0,160}\bDROP\b)\b/giu;
  for (const file of files) {
    const source = (await readFile(resolve("packages/database/drizzle", file), "utf8"))
      .replace(/--.*$/gmu, "");
    if (destructive.test(source)) findings.push(file);
    destructive.lastIndex = 0;
  }
  return findings;
}

async function schemaState(connection) {
  const tables = await connection.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any($1::text[])
    order by table_name
  `, [["profiles", "listings", "listing_images", "auth_sessions"]]);
  const indexes = await connection.query(`
    select count(*)::integer as count
    from pg_indexes
    where schemaname = 'public'
  `);
  const constraints = await connection.query(`
    select count(*)::integer as count
    from information_schema.table_constraints
    where table_schema = 'public'
  `);
  const enumResult = await connection.query(`
    select e.enumlabel
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'listing_image_review_status'
    order by e.enumsortorder
  `);
  return {
    criticalTables: tables.rows.map((row) => row.table_name),
    publicIndexCount: indexes.rows[0].count,
    publicConstraintCount: constraints.rows[0].count,
    enumLabels: enumResult.rows.map((row) => row.enumlabel)
  };
}

function assertDifferentDatabaseUrls() {
  const other = String(process.env.OTHER_ENV_DATABASE_URL || "").trim();
  const otherFingerprint = String(process.env.OTHER_ENV_DATABASE_FINGERPRINT || "").trim();
  if (!other && !/^[a-f0-9]{64}$/u.test(otherFingerprint)) {
    fail("OTHER_ENV_DATABASE_FINGERPRINT is required to prove staging/production database isolation.");
  }
  if (other && normalizeDatabaseUrl(other) === normalizeDatabaseUrl(databaseUrl)) {
    fail("DATABASE_URL must not equal OTHER_ENV_DATABASE_URL.");
  }
  if (otherFingerprint && otherFingerprint === databaseTargetFingerprint(databaseUrl)) {
    fail("DATABASE_URL resolves to the other environment database target.");
  }
}

function normalizeDatabaseUrl(value) {
  const parsed = new URL(value);
  parsed.username = "";
  parsed.password = "";
  parsed.searchParams.sort();
  return parsed.toString();
}

function databaseTargetFingerprint(value) {
  const parsed = new URL(value);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  const identity = `${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}/${databaseName}`;
  return createHash("sha256").update(identity).digest("hex");
}

function assertQdrantCredentialIsolation() {
  if (process.env.RAG_ENABLED !== "true") return;
  const apiKey = required("RAG_QDRANT_API_KEY");
  const otherHash = String(process.env.OTHER_ENV_QDRANT_API_KEY_SHA256 || "").trim();
  if (!/^[a-f0-9]{64}$/u.test(otherHash)) {
    fail("OTHER_ENV_QDRANT_API_KEY_SHA256 is required when RAG is enabled.");
  }
  const currentHash = createHash("sha256").update(apiKey).digest("hex");
  if (currentHash === otherHash) {
    fail("RAG_QDRANT_API_KEY must differ from the other environment credential.");
  }
}

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) fail(`${name} is required.`);
  return value;
}

function readArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

function fail(message) {
  process.stderr.write(`Database release safety failed: ${message}\n`);
  process.exit(1);
}

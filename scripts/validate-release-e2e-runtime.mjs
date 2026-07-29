#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function validateReleaseE2ERuntime(env = process.env) {
  if (env.NODE_ENV !== "development") {
    throw new Error("Release E2E requires NODE_ENV=development.");
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  const testDatabaseUrl = env.TEST_DATABASE_URL?.trim();
  if (!databaseUrl || !testDatabaseUrl) {
    throw new Error("Release E2E requires both DATABASE_URL and TEST_DATABASE_URL.");
  }
  if (databaseUrl !== testDatabaseUrl) {
    throw new Error("DATABASE_URL and TEST_DATABASE_URL must be identical for release E2E.");
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Release E2E database URL must be a valid PostgreSQL URL.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Release E2E database URL must use postgres or postgresql.");
  }
  if (!LOCAL_DATABASE_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Release E2E database must use localhost or a loopback address.");
  }
  if (decodeURIComponent(parsed.pathname.slice(1)) !== "babyloop_test") {
    throw new Error("Release E2E database name must be exactly babyloop_test.");
  }

  return {
    database: "babyloop_test",
    hostClass: "loopback",
    nodeEnv: "development"
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.stdout.write(`${JSON.stringify(validateReleaseE2ERuntime())}\n`);
  } catch (error) {
    process.stderr.write(`Release E2E runtime guard failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

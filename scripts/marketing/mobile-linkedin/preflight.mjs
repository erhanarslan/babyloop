#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAFE_DATABASE_NAME = /(babyloop|test|local|dev)/iu;
const LOCAL_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export function verifyLocalDatabaseUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL geçerli bir URL değil.");
  }

  if (!LOCAL_HOSTS.has(url.hostname) || !SAFE_DATABASE_NAME.test(url.pathname)) {
    throw new Error("Ekran görüntüsü otomasyonu yalnız local/test veritabanıyla çalışır.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Ekran görüntüsü otomasyonu PostgreSQL local/test veritabanı bekler.");
  }

  return true;
}

export function verifyLocalHttpUrl(value, label) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} geçerli bir URL değil.`);
  }

  if (url.protocol !== "http:" || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`${label} yalnız yerel HTTP hedefi olabilir.`);
  }

  return true;
}

export function readEnvValue(filePath, key) {
  const line = readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .find((entry) => entry.startsWith(`${key}=`));

  if (!line) {
    return null;
  }

  const raw = line.slice(key.length + 1).trim();
  const quote = raw.at(0);

  return quote && (quote === "\"" || quote === "'") && raw.at(-1) === quote
    ? raw.slice(1, -1)
    : raw;
}

async function main() {
  const envPath = resolve(process.argv[2] ?? ".env.local");
  const databaseUrl = process.env.DATABASE_URL ?? readEnvValue(envPath, "DATABASE_URL");
  const apiUrl = process.env.MARKETING_API_URL ?? "http://127.0.0.1:4000";

  if (!databaseUrl) {
    throw new Error(`DATABASE_URL bulunamadı: ${envPath}`);
  }

  verifyLocalDatabaseUrl(databaseUrl);
  verifyLocalHttpUrl(apiUrl, "MARKETING_API_URL");
  console.log("Local/test API ve veritabanı hedefi doğrulandı.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Marketing preflight başarısız.");
    process.exitCode = 1;
  });
}

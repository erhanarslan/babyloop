#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = process.cwd();
const TARGETS = ["apps/web/src", "apps/mobile/src", "apps/mobile/app"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const endpointPattern = /(?:`|'|")(\/api\/v1\/[A-Za-z0-9_?=&${}.:\/\-]+)(?:`|'|")/gu;

const files = TARGETS.flatMap((target) => walk(resolve(ROOT, target)));
const rows = [];
const timerRows = [];
const lifecycleRows = [];

for (const absolutePath of files) {
  const source = readFileSync(absolutePath, "utf8");
  const file = relative(ROOT, absolutePath);
  const platform = file.startsWith("apps/web/") ? "web" : "mobile";
  const endpoints = [...source.matchAll(endpointPattern)].map((match) => normalizeEndpoint(match[1]));
  const fetchCalls = count(source, /\bfetch\s*\(/gu);
  const authFetchCalls = count(source, /\bauthFetch\s*\(/gu);
  const mobileAuthFetchCalls = count(source, /\bmobileAuthFetch\s*\(/gu);

  if (endpoints.length > 0 || fetchCalls + authFetchCalls + mobileAuthFetchCalls > 0) {
    rows.push({
      platform,
      file,
      endpoints: [...new Set(endpoints)].sort(),
      fetchCalls,
      authFetchCalls,
      mobileAuthFetchCalls
    });
  }

  const intervals = count(source, /\b(?:window\.)?setInterval\s*\(/gu);
  const timeouts = count(source, /\b(?:window\.)?setTimeout\s*\(/gu);

  if (intervals > 0 || timeouts > 0) {
    timerRows.push({ platform, file, intervals, timeouts });
  }

  const addEvents = literalEvents(source, /(?:window|document|AppState)\.addEventListener\(\s*["']([^"']+)["']/gu);
  const removeEvents = literalEvents(source, /(?:window|document)\.removeEventListener\(\s*["']([^"']+)["']/gu);
  const socketOn = literalEvents(source, /(?:socket|realtimeSocket)\.on\(\s*([^,\n]+)/gu);
  const socketOff = literalEvents(source, /(?:socket|realtimeSocket)\.off\(\s*([^,\n]+)/gu);

  if (addEvents.length || removeEvents.length || socketOn.length || socketOff.length) {
    lifecycleRows.push({ platform, file, addEvents, removeEvents, socketOn, socketOff });
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  sourceFilesScanned: files.length,
  requestFiles: rows.length,
  endpointReferences: rows.reduce((sum, row) => sum + row.endpoints.length, 0),
  directFetchCalls: rows.reduce((sum, row) => sum + row.fetchCalls, 0),
  webAuthFetchCalls: rows.reduce((sum, row) => sum + row.authFetchCalls, 0),
  mobileAuthFetchCalls: rows.reduce((sum, row) => sum + row.mobileAuthFetchCalls, 0),
  timerFiles: timerRows.length,
  lifecycleFiles: lifecycleRows.length
};

const payload = { summary, requests: rows, timers: timerRows, lifecycle: lifecycleRows };

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  console.log("BabyLoop web/mobile request lifecycle audit");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nRequest call sites:");
  for (const row of rows) {
    console.log(`- [${row.platform}] ${row.file}`);
    if (row.endpoints.length) console.log(`  endpoints: ${row.endpoints.join(", ")}`);
    console.log(`  fetch=${row.fetchCalls} authFetch=${row.authFetchCalls} mobileAuthFetch=${row.mobileAuthFetchCalls}`);
  }
  console.log("\nTimer-bearing files:");
  for (const row of timerRows) {
    console.log(`- [${row.platform}] ${row.file}: intervals=${row.intervals}, timeouts=${row.timeouts}`);
  }
}

function walk(directory) {
  if (!statSafe(directory)) return [];
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    if (!entry.isFile()) return [];
    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    if (!SOURCE_EXTENSIONS.has(extension) || /\.(?:test|spec)\.[^.]+$/u.test(entry.name)) return [];
    return [absolute];
  });
}

function statSafe(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function literalEvents(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1].trim()).sort();
}

function normalizeEndpoint(endpoint) {
  return endpoint
    .replace(/\$\{[^}]+\}/gu, ":param")
    .replace(/[?&][^/]*$/u, "")
    .replace(/\/+$/u, "");
}

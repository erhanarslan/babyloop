#!/usr/bin/env node

const url = process.argv[2];
const timeoutMs = readPositiveInteger(process.argv[3], 60_000, "timeoutMs");
const intervalMs = readPositiveInteger(process.argv[4], 1_000, "intervalMs");

if (!url) {
  console.error("Usage: node scripts/wait-on-url.mjs <url> [timeoutMs] [intervalMs]");
  process.exit(2);
}

const startedAt = Date.now();
let lastError = "";

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(Math.min(intervalMs, 5_000))
    });

    if (response.status >= 200 && response.status < 500) {
      console.log(`Ready: ${url} -> ${response.status}`);
      process.exit(0);
    }

    lastError = `HTTP ${response.status}`;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

console.error(`Timed out waiting for ${url}. Last error: ${lastError || "unknown"}`);
process.exit(1);

function readPositiveInteger(value, fallback, label) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const normalized = String(value).replaceAll("_", "");
  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`${label} must be a positive integer. Received: ${value}`);
    process.exit(2);
  }

  return parsed;
}

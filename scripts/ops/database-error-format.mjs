const MAX_ERROR_COUNT = 12;
const MAX_DEPTH = 4;

export function formatDatabaseError(error, databaseUrl = "") {
  const messages = [];
  const visited = new Set();
  const sensitiveValues = connectionSensitiveValues(databaseUrl);

  visit(error, 0);

  return [...new Set(messages)].join(" | ")
    || "Unknown database release error.";

  function visit(value, depth) {
    if (
      value == null
      || depth > MAX_DEPTH
      || messages.length >= MAX_ERROR_COUNT
    ) {
      return;
    }

    if (
      (typeof value === "object" || typeof value === "function")
      && visited.has(value)
    ) {
      return;
    }

    if (typeof value === "object" || typeof value === "function") {
      visited.add(value);
    }

    const code = safeScalar(value?.code);
    const syscall = safeScalar(value?.syscall);
    const message = errorMessage(value);

    const fields = [];

    if (code) fields.push(`code=${sanitize(code)}`);
    if (syscall) fields.push(`syscall=${sanitize(syscall)}`);
    if (message) fields.push(`message=${sanitize(message)}`);

    if (fields.length > 0) {
      messages.push(fields.join(", "));
    }

    if (Array.isArray(value?.errors)) {
      for (const nested of value.errors) {
        visit(nested, depth + 1);
      }
    }

    if (value?.cause && value.cause !== value) {
      visit(value.cause, depth + 1);
    }
  }

  function sanitize(input) {
    let output = String(input)
      .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[DATABASE_URL]")
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu, "[IP]")
      .replace(/\[[0-9a-f:]+\]/giu, "[IPV6]");

    for (const sensitive of sensitiveValues) {
      output = output.split(sensitive).join("[REDACTED]");
    }

    return output.trim();
  }
}

function connectionSensitiveValues(databaseUrl) {
  if (!databaseUrl) return [];

  try {
    const parsed = new URL(databaseUrl);

    return [
      databaseUrl,
      parsed.username,
      parsed.password,
      parsed.hostname,
    ]
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);
  } catch {
    return [databaseUrl];
  }
}

function errorMessage(value) {
  if (value instanceof Error) {
    return String(value.message || "").trim();
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

function safeScalar(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return String(value).trim();
}

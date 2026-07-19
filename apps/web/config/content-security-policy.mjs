const LOCAL_API_ORIGINS = [
  "http://localhost:4000",
  "ws://localhost:4000",
  "http://127.0.0.1:4000",
  "ws://127.0.0.1:4000"
];

export function buildContentSecurityPolicy({ apiBaseUrl, nodeEnv }) {
  const isDevelopment = nodeEnv !== "production";
  const connectSources = new Set(["'self'"]);

  if (isDevelopment) {
    for (const origin of LOCAL_API_ORIGINS) {
      connectSources.add(origin);
    }
  }

  const configuredOrigins = resolveConfiguredApiOrigins(apiBaseUrl, {
    allowInsecure: isDevelopment
  });

  for (const origin of configuredOrigins) {
    connectSources.add(origin);
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: http: https:",
    "font-src 'self' data:",
    `connect-src ${Array.from(connectSources).join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join("; ");
}

export function resolveConfiguredApiOrigins(apiBaseUrl, { allowInsecure = false } = {}) {
  const normalized = apiBaseUrl?.trim();

  if (!normalized) {
    return [];
  }

  try {
    const url = new URL(normalized);

    if (url.protocol !== "https:" && !(allowInsecure && url.protocol === "http:")) {
      return [];
    }

    const websocketUrl = new URL(url.origin);
    websocketUrl.protocol = url.protocol === "https:" ? "wss:" : "ws:";

    return [url.origin, websocketUrl.origin];
  } catch {
    return [];
  }
}

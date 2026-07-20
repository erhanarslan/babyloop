import type { RuntimeMetricsRegistry } from "./runtime-metrics.service.js";

export type RuntimeErrorContext = {
  event: string;
  requestId?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  workerName?: string;
  workerId?: string;
};

export type RuntimeObservability = {
  enabled: boolean;
  captureException: (error: unknown, context: RuntimeErrorContext) => Promise<void>;
};

export function createRuntimeObservability(options: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  metrics?: RuntimeMetricsRegistry;
} = {}): RuntimeObservability {
  const env = options.env ?? process.env;
  const endpoint = normalizeEndpoint(env.OBSERVABILITY_ERROR_WEBHOOK_URL, env.NODE_ENV);
  const token = env.OBSERVABILITY_ERROR_WEBHOOK_TOKEN?.trim();
  const timeoutMs = readPositiveInteger(env.OBSERVABILITY_ERROR_REPORT_TIMEOUT_MS, 2500);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  if (!endpoint) {
    return {
      enabled: false,
      captureException: async () => undefined
    };
  }

  return {
    enabled: true,
    async captureException(error, context) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(buildSafeErrorPayload(error, context, env)),
          signal: controller.signal
        });

        options.metrics?.recordErrorReport(response.ok);
      } catch {
        options.metrics?.recordErrorReport(false);
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

export function buildSafeErrorPayload(
  error: unknown,
  context: RuntimeErrorContext,
  env: NodeJS.ProcessEnv = process.env
): Record<string, unknown> {
  const normalized = normalizeError(error);

  return {
    service: env.OBSERVABILITY_SERVICE_NAME?.trim().slice(0, 80) || "babyloop-api",
    environment: env.OBSERVABILITY_ENVIRONMENT?.trim().slice(0, 80) || env.NODE_ENV?.trim().slice(0, 80) || "development",
    occurredAt: new Date().toISOString(),
    error: normalized,
    context: {
      event: sanitizeText(context.event, 80),
      ...(context.requestId ? { requestId: sanitizeText(context.requestId, 120) } : {}),
      ...(context.method ? { method: sanitizeText(context.method, 16) } : {}),
      ...(context.route ? { route: sanitizeRoute(context.route) } : {}),
      ...(typeof context.statusCode === "number" ? { statusCode: context.statusCode } : {}),
      ...(context.workerName ? { workerName: sanitizeText(context.workerName, 80) } : {}),
      ...(context.workerId ? { workerId: sanitizeText(context.workerId, 120) } : {})
    }
  };
}

function normalizeError(error: unknown): { name: string; code: string | null; message: string } {
  if (error instanceof Error) {
    return {
      name: sanitizeText(error.name, 80) || "Error",
      code: "code" in error ? sanitizeText(String(error.code), 80) || null : null,
      message: redactSensitiveText(error.message, 500) || "Unexpected runtime error."
    };
  }

  return {
    name: "UnknownError",
    code: null,
    message: "Unexpected runtime error."
  };
}

function normalizeEndpoint(value: string | undefined, nodeEnv: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const url = new URL(trimmed);
  const localHttp = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");

  if (url.protocol !== "https:" && !(nodeEnv !== "production" && localHttp)) {
    throw new Error("OBSERVABILITY_ERROR_WEBHOOK_URL must use HTTPS outside local development.");
  }

  return url.toString();
}

function redactSensitiveText(value: string, maxLength: number): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[redacted-database-url]")
    .replace(/https?:\/\/[^\s]*[?&](?:token|key|secret|signature)=[^\s&]+/giu, "[redacted-url]")
    .replace(/bearer\s+[a-z0-9._~+/=-]+/giu, "Bearer [redacted]")
    .replace(/(?:token|secret|password|authorization|cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/giu, "$1=[redacted]")
    .trim()
    .slice(0, maxLength);
}

function sanitizeRoute(value: string): string {
  return value.split("?")[0]?.replace(/[\r\n]/gu, "_").slice(0, 180) || "/unknown";
}

function sanitizeText(value: string, maxLength: number): string {
  return value.replace(/[\r\n]/gu, " ").trim().slice(0, maxLength);
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

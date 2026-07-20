import { getApiBaseUrl } from "../config/api";

export type ApiClientResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
      status?: number;
    };

export async function apiGet<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiClientResult<T>> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  return apiRequest<T>(path, {
    ...init,
    method: "GET",
    headers
  });
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiClientResult<T>> {
  const apiBaseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  try {
    const response = await fetch(`${apiBaseUrl}${normalizedPath}`, init);
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: safeApiErrorMessage(payload, `Request failed with status ${response.status}.`)
      };
    }

    return {
      ok: true,
      data: unwrapApiData<T>(payload)
    };
  } catch {
    return {
      ok: false,
      error: "Network request failed."
    };
  }
}

export function resolveApiAssetUrl(url: string | null | undefined): string | null {
  const rawUrl = typeof url === "string" ? url.trim() : "";

  if (!rawUrl) {
    return null;
  }

  const apiBaseUrl = getApiBaseUrl();

  try {
    const parsedUrl = new URL(rawUrl, `${apiBaseUrl}/`);

    if (isLocalDevelopmentHost(parsedUrl.hostname)) {
      const apiUrl = new URL(apiBaseUrl);
      parsedUrl.hostname = apiUrl.hostname;
      parsedUrl.protocol = apiUrl.protocol;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function safeApiErrorMessage(payload: unknown, fallback: string): string {
  const message = extractApiError(payload) ?? fallback;

  return redactSensitiveText(message);
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/giu, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9._-]+/gu, "[redacted-token]")
    .replace(/accessToken["':=\s]+[A-Za-z0-9._-]+/giu, "accessToken=[redacted]")
    .replace(/refreshToken["':=\s]+[A-Za-z0-9._-]+/giu, "refreshToken=[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]");
}

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

function unwrapApiData<T>(payload: unknown): T {
  if (isRecord(payload) && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

function extractApiError(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

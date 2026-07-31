import type { ApiResponse } from "@babyloop/shared";

export const BACKOFFICE_AUTH_CHANGED_EVENT = "babyloop-backoffice-auth-changed";

const BACKOFFICE_CSRF_COOKIE_NAME = "babyloop_backoffice_csrf_token";
const BACKOFFICE_CSRF_HEADER_NAME = "x-babyloop-csrf-token";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type BackofficeAuthLifecycleState = "unknown" | "authenticated" | "anonymous";

export function buildBackofficeGoogleStartUrl(
  apiBaseUrl: string,
  nextPath: string
): string {
  const url = new URL("/api/v1/auth/backoffice/google/start", apiBaseUrl);
  if (nextPath !== "/") url.searchParams.set("next", nextPath);
  return url.toString();
}

const BACKOFFICE_OAUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  google_auth_failed: "Google ile giriş tamamlanamadı. Lütfen tekrar dene.",
  google_auth_unavailable: "Google ile giriş şu anda kullanılamıyor.",
  google_account_not_found: "Bu Google hesabı BabyLoop’ta kayıtlı değil. Önce BabyLoop üzerinden hesabını oluştur.",
  google_account_not_linked: "Bu BabyLoop hesabında Google girişi bağlı değil. Önce BabyLoop hesabından Google ile giriş yap.",
  account_disabled: "Bu hesabın girişi devre dışı bırakılmış.",
  access_denied: "Google giriş isteği iptal edildi.",
  session_establishment_failed: "Backoffice oturumu oluşturulamadı. Lütfen tekrar dene.",
};

export function resolveBackofficeOAuthErrorMessage(value: string | null): string | null {
  return value ? BACKOFFICE_OAUTH_ERROR_MESSAGES[value] ?? null : null;
}

let cachedBackofficeCsrfToken: string | null = null;
let backofficeCsrfTokenPromise: Promise<string | null> | null = null;
let backofficeMePromise: Promise<BackofficeAuthMe | null> | null = null;
let refreshSessionPromise: Promise<boolean> | null = null;
let authLifecycleState: BackofficeAuthLifecycleState = "unknown";
const backofficeLoginFlights = new Map<string, Promise<BackofficeLoginResult>>();

export type BackofficeAuthUser = {
  id: string;
  email: string;
  role: string;
  emailVerified?: boolean;
};

export type BackofficeAuthMe = {
  accessMode: "preview" | "staff";
  user: BackofficeAuthUser;
};

type LoginResponse = {
  accessMode: "preview" | "staff";
  user: BackofficeAuthUser;
};

type BackofficeCsrfResponse = {
  csrfToken: string;
};

type BackofficeLoginResult =
  | { ok: true; auth: LoginResponse }
  | { ok: false; message: string; retryAfterSeconds: number | null };

export async function loginBackoffice(
  apiBaseUrl: string,
  input: {
    email: string;
    password: string;
  },
): Promise<BackofficeLoginResult> {
  const endpoint = `${apiBaseUrl}/api/v1/auth/backoffice/login`;
  const flightKey = `${endpoint}:${await fingerprintAuthPayload(input)}`;
  const existingFlight = backofficeLoginFlights.get(flightKey);
  if (existingFlight) return existingFlight;

  const flight = loginBackofficeOnce(apiBaseUrl, input).finally(() => {
    backofficeLoginFlights.delete(flightKey);
  });
  backofficeLoginFlights.set(flightKey, flight);
  return flight;
}

async function fingerprintAuthPayload(payload: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(stableJson(payload));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

async function loginBackofficeOnce(
  apiBaseUrl: string,
  input: { email: string; password: string },
): Promise<BackofficeLoginResult> {
  try {
    clearBackofficeCsrfToken();

    const response = await fetch(`${apiBaseUrl}/api/v1/auth/backoffice/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const body = (await response.json()) as ApiResponse<
      LoginResponse | { mfaRequired: true }
    >;

    if (!response.ok || !body.ok) {
      return {
        ok: false,
        message: getApiErrorMessage(body, "Login failed."),
        retryAfterSeconds: readRetryAfterSeconds(response),
      };
    }

    if (!("user" in body.data)) {
      return {
        ok: false,
        message: "Additional verification is required before backoffice login.",
        retryAfterSeconds: null,
      };
    }

    authLifecycleState = "authenticated";
    await ensureBackofficeCsrfToken(apiBaseUrl, { forceRefresh: true });
    dispatchAuthChanged();

    return {
      ok: true,
      auth: body.data,
    };
  } catch {
    return {
      ok: false,
      message: "Login request failed.",
      retryAfterSeconds: null,
    };
  }
}

function readRetryAfterSeconds(response: Response): number | null {
  const value = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function logoutBackoffice(apiBaseUrl: string): Promise<void> {
  try {
    await fetch(
      `${apiBaseUrl}/api/v1/auth/backoffice/logout`,
      await buildAuthRequestInit(apiBaseUrl, {
        method: "POST",
      }),
    );
  } finally {
    clearBackofficeAuthRequestState();
    markBackofficeUnauthenticated();
    dispatchAuthChanged();
  }
}

export async function authFetch(
  apiBaseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const requestUrl = `${apiBaseUrl}${path}`;

  const firstResponse = await fetch(
    requestUrl,
    await buildAuthRequestInit(apiBaseUrl, init),
  );

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  const refreshed = await refreshSession(apiBaseUrl);

  if (!refreshed) {
    return firstResponse;
  }

  return fetch(requestUrl, await buildAuthRequestInit(apiBaseUrl, init));
}

export async function fetchBackofficeMe(
  apiBaseUrl: string,
): Promise<BackofficeAuthMe | null> {
  if (authLifecycleState === "anonymous") {
    return null;
  }

  if (backofficeMePromise) {
    return backofficeMePromise;
  }

  backofficeMePromise = fetchBackofficeMeOnce(apiBaseUrl).finally(() => {
    backofficeMePromise = null;
  });

  return backofficeMePromise;
}

async function fetchBackofficeMeOnce(apiBaseUrl: string): Promise<BackofficeAuthMe | null> {
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/backoffice/me");

  if (response.status === 401 || response.status === 403) {
    markBackofficeUnauthenticated();
    return null;
  }

  const body = (await response.json()) as ApiResponse<BackofficeAuthMe>;

  if (!response.ok || !body.ok) {
    return null;
  }

  authLifecycleState = "authenticated";
  return body.data;
}

async function refreshSession(apiBaseUrl: string): Promise<boolean> {
  if (refreshSessionPromise) {
    return refreshSessionPromise;
  }

  refreshSessionPromise = refreshSessionOnce(apiBaseUrl).finally(() => {
    refreshSessionPromise = null;
  });

  return refreshSessionPromise;
}

async function refreshSessionOnce(apiBaseUrl: string): Promise<boolean> {
  try {
    clearBackofficeCsrfToken();

    const response = await fetch(`${apiBaseUrl}/api/v1/auth/backoffice/refresh`, {
      method: "POST",
      credentials: "include",
    });

    const body = (await response.json()) as ApiResponse<BackofficeAuthMe>;

    if (!response.ok || !body.ok) {
      if (response.status === 401 || response.status === 403) {
        markBackofficeUnauthenticated();
      }

      return false;
    }

    authLifecycleState = "authenticated";
    await ensureBackofficeCsrfToken(apiBaseUrl, { forceRefresh: true });

    return true;
  } catch {
    return false;
  }
}

async function buildAuthRequestInit(
  apiBaseUrl: string,
  init?: RequestInit,
): Promise<RequestInit> {
  const headers = new Headers(init?.headers);

  if (isUnsafeRequest(init)) {
    const csrfToken = await ensureBackofficeCsrfToken(apiBaseUrl);

    if (csrfToken) {
      headers.set(BACKOFFICE_CSRF_HEADER_NAME, csrfToken);
    }
  }

  return {
    ...init,
    credentials: "include",
    headers,
  };
}

async function ensureBackofficeCsrfToken(
  apiBaseUrl: string,
  options: { forceRefresh?: boolean } = {},
): Promise<string | null> {
  if (!options.forceRefresh && cachedBackofficeCsrfToken) {
    return cachedBackofficeCsrfToken;
  }

  if (!options.forceRefresh && backofficeCsrfTokenPromise) {
    return backofficeCsrfTokenPromise;
  }

  if (!options.forceRefresh) {
    const cookieToken = readCsrfTokenFromDocumentCookie();

    if (cookieToken) {
      cachedBackofficeCsrfToken = cookieToken;
      return cookieToken;
    }
  }

  backofficeCsrfTokenPromise = fetchBackofficeCsrfToken(apiBaseUrl).finally(() => {
    backofficeCsrfTokenPromise = null;
  });

  return backofficeCsrfTokenPromise;
}

async function fetchBackofficeCsrfToken(apiBaseUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/backoffice/csrf`, {
      method: "GET",
      credentials: "include",
    });

    const body = (await response.json()) as ApiResponse<BackofficeCsrfResponse>;

    if (!response.ok || !body.ok) {
      cachedBackofficeCsrfToken = null;
      return null;
    }

    cachedBackofficeCsrfToken = body.data.csrfToken;
    return cachedBackofficeCsrfToken;
  } catch {
    cachedBackofficeCsrfToken = null;
    return null;
  }
}

function isUnsafeRequest(init?: RequestInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase();

  return UNSAFE_METHODS.has(method);
}

function readCsrfTokenFromDocumentCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  for (const cookiePart of document.cookie.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split("=");

    if (rawName !== BACKOFFICE_CSRF_COOKIE_NAME) {
      continue;
    }

    const rawValue = rawValueParts.join("=");

    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}

function clearBackofficeCsrfToken(): void {
  cachedBackofficeCsrfToken = null;
  backofficeCsrfTokenPromise = null;
}

function clearBackofficeAuthRequestState(): void {
  clearBackofficeCsrfToken();
  backofficeMePromise = null;
  refreshSessionPromise = null;
  authLifecycleState = "unknown";
}

function markBackofficeUnauthenticated(): void {
  authLifecycleState = "anonymous";
}

export function resetBackofficeAuthClientForTests(): void {
  clearBackofficeAuthRequestState();
  backofficeLoginFlights.clear();
}

export function getBackofficeAuthLifecycleStateForTests(): BackofficeAuthLifecycleState {
  return authLifecycleState;
}

function getApiErrorMessage(body: ApiResponse<unknown>, fallback: string): string {
  if (body.ok) {
    return fallback;
  }

  return body.error?.message ?? fallback;
}

function dispatchAuthChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(BACKOFFICE_AUTH_CHANGED_EVENT));
}

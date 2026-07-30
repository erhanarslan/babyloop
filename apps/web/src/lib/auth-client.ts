import type { ApiResponse } from "@babyloop/shared";

export const AUTH_CHANGED_EVENT = "babyloop-auth-changed";
export const AUTH_SESSION_ENDED_EVENT = "babyloop-auth-session-ended";

const PUBLIC_CSRF_HEADER_NAME = "x-babyloop-csrf-token";

export type AuthMe = {
  user: {
    id: string;
    email: string;
    emailVerifiedAt?: string | null;
    role: string;
  };
  profile: {
    id: string;
    displayName: string;
    locationCity: string | null;
  };
};

export type AuthPayload = AuthMe & {
  accessToken: string;
  devEmailVerificationToken?: string;
  emailVerificationDelivery?: "sent" | "deferred";
};

let refreshSessionPromise: Promise<ApiResponse<AuthPayload>> | null = null;
let fetchCurrentUserWithoutRefreshPromise: Promise<ApiResponse<AuthMe>> | null = null;
let publicCsrfTokenPromise: Promise<string | null> | null = null;
let authSessionVersion = 0;
let memoryAuthToken: string | null = null;
let cachedPublicCsrfToken: string | null = null;
let cachedCurrentAuth: { auth: AuthMe; cachedAt: number; token: string } | null = null;
let manuallyLoggedOut = false;
let lastRefreshFailureAt = 0;

const REFRESH_FAILURE_COOLDOWN_MS = 15_000;
export const CURRENT_AUTH_CACHE_TTL_MS = 30_000;

export function getAuthToken(): string | null {
  return memoryAuthToken;
}

export function setAuthPayload(
  payload: AuthPayload,
  options: { broadcast?: boolean } = {}
): void {
  setAuthToken(payload.accessToken, {
    currentAuth: {
      profile: payload.profile,
      user: payload.user
    },
    ...(options.broadcast === undefined ? {} : { broadcast: options.broadcast })
  });
}

export function setAuthToken(
  token: string,
  options: { currentAuth?: AuthMe; broadcast?: boolean } = {}
): void {
  const tokenChanged = memoryAuthToken !== token;
  memoryAuthToken = token;
  manuallyLoggedOut = false;
  lastRefreshFailureAt = 0;
  fetchCurrentUserWithoutRefreshPromise = null;

  if (options.currentAuth) {
    cachedCurrentAuth = {
      auth: options.currentAuth,
      cachedAt: Date.now(),
      token
    };
  } else if (tokenChanged) {
    cachedCurrentAuth = null;
  }

  if (tokenChanged) {
    authSessionVersion += 1;
  }

  if (options.broadcast ?? true) {
    dispatchAuthEvent(AUTH_CHANGED_EVENT);
  }
}

export function clearAuthToken(options: { broadcast?: boolean } = {}): void {
  const hadToken = memoryAuthToken !== null;
  const shouldBroadcast = options.broadcast ?? false;

  memoryAuthToken = null;
  cachedPublicCsrfToken = null;
  cachedCurrentAuth = null;
  fetchCurrentUserWithoutRefreshPromise = null;
  publicCsrfTokenPromise = null;

  if (hadToken || shouldBroadcast) {
    authSessionVersion += 1;
  }

  if (hadToken) {
    dispatchAuthEvent(AUTH_SESSION_ENDED_EVENT);
  }

  if (shouldBroadcast) {
    dispatchAuthEvent(AUTH_CHANGED_EVENT);
  }
}

export function authHeader(): HeadersInit {
  const token = getAuthToken();

  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function refreshSession(
  apiBaseUrl: string,
  options: { force?: boolean } = {}
): Promise<ApiResponse<AuthPayload>> {
  if (!options.force && isManuallyLoggedOut()) {
    return unauthorizedResponse();
  }

  if (
    !options.force &&
    lastRefreshFailureAt > 0 &&
    Date.now() - lastRefreshFailureAt < REFRESH_FAILURE_COOLDOWN_MS
  ) {
    return unauthorizedResponse();
  }

  if (!options.force && refreshSessionPromise) {
    return refreshSessionPromise;
  }

  const startedSessionVersion = authSessionVersion;
  const refreshPromise = doRefreshSession(apiBaseUrl, {
    force: options.force ?? false,
    startedSessionVersion
  });

  if (options.force) {
    return refreshPromise;
  }

  refreshSessionPromise = refreshPromise.finally(() => {
    refreshSessionPromise = null;
  });

  return refreshSessionPromise;
}

async function doRefreshSession(
  apiBaseUrl: string,
  options: { force: boolean; startedSessionVersion: number }
): Promise<ApiResponse<AuthPayload>> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include"
    });
    const body = await readApiResponse<AuthPayload>(response);

    if (response.ok && body.ok) {
      if (
        !options.force &&
        (isManuallyLoggedOut() || options.startedSessionVersion !== authSessionVersion)
      ) {
        return unauthorizedResponse();
      }

      lastRefreshFailureAt = 0;
      setAuthToken(body.data.accessToken, {
        currentAuth: {
          profile: body.data.profile,
          user: body.data.user
        }
      });
      return body;
    }

    if (isSessionRejectionStatus(response.status)) {
      lastRefreshFailureAt = Date.now();
      clearAuthToken({ broadcast: true });
      return body.ok ? unauthorizedResponse() : body;
    }

    if (!response.ok || body.ok || body.error.code === "API_UNAVAILABLE") {
      return apiUnavailableResponse();
    }

    return body;
  } catch {
    return apiUnavailableResponse();
  }
}

export async function getOrRefreshAuthToken(apiBaseUrl: string): Promise<string | null> {
  if (isManuallyLoggedOut()) {
    clearAuthToken();
    return null;
  }

  const existingToken = getAuthToken();

  if (existingToken) {
    return existingToken;
  }

  const refreshed = await refreshSession(apiBaseUrl);

  return refreshed.ok ? refreshed.data.accessToken : null;
}

export async function logout(
  apiBaseUrl: string,
  options: { broadcast?: boolean } = {}
): Promise<void> {
  markManuallyLoggedOut();
  clearAuthToken({ broadcast: options.broadcast ?? true });

  try {
    await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
  } catch {
    return;
  }
}

export function logoutAndRedirectToHome(apiBaseUrl: string): void {
  markManuallyLoggedOut();
  clearAuthToken({ broadcast: false });

  try {
    void fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      keepalive: true
    });
  } catch {
    // Explicit logout is a client-side session boundary even if the server is unreachable.
  }

  window.location.replace("/");
}

export async function validateCurrentAuthSession(apiBaseUrl: string): Promise<boolean> {
  if (isManuallyLoggedOut()) {
    clearAuthToken();
    return false;
  }

  try {
    const response = await authFetch(apiBaseUrl, "/api/v1/auth/me");

    if (isSessionRejectionStatus(response.status)) {
      clearAuthToken({ broadcast: true });
      return false;
    }

    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchCurrentUserWithoutRefresh(
  apiBaseUrl: string,
  options: { force?: boolean } = {}
): Promise<ApiResponse<AuthMe>> {
  const token = getAuthToken();

  if (!options.force && token && cachedCurrentAuth?.token === token) {
    const ageMs = Date.now() - cachedCurrentAuth.cachedAt;

    if (ageMs < CURRENT_AUTH_CACHE_TTL_MS) {
      return {
        ok: true,
        data: cachedCurrentAuth.auth
      };
    }
  }

  if (fetchCurrentUserWithoutRefreshPromise) {
    return fetchCurrentUserWithoutRefreshPromise;
  }

  fetchCurrentUserWithoutRefreshPromise = fetchCurrentUserWithoutRefreshOnce(apiBaseUrl).finally(() => {
    fetchCurrentUserWithoutRefreshPromise = null;
  });

  return fetchCurrentUserWithoutRefreshPromise;
}

async function fetchCurrentUserWithoutRefreshOnce(apiBaseUrl: string): Promise<ApiResponse<AuthMe>> {
  try {
    const headers = new Headers();
    const token = getAuthToken();

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
      credentials: "include",
      headers
    });

    const body = await readApiResponse<AuthMe>(response);

    if (isSessionRejectionStatus(response.status)) {
      clearAuthToken({ broadcast: false });
      return body.ok ? unauthorizedResponse<AuthMe>() : body;
    }

    if (!response.ok) {
      return body.ok ? apiUnavailableResponse<AuthMe>() : body;
    }

    if (body.ok && token) {
      cachedCurrentAuth = {
        auth: body.data,
        cachedAt: Date.now(),
        token
      };
    }

    return body;
  } catch {
    return apiUnavailableResponse<AuthMe>();
  }
}

export async function authFetch(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const requestUrl = `${apiBaseUrl}${path}`;
  const response = await fetch(requestUrl, await buildAuthRequestInit(apiBaseUrl, init));

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSession(apiBaseUrl);

  if (!refreshed.ok) {
    return response;
  }

  return fetch(requestUrl, await buildAuthRequestInit(apiBaseUrl, init));
}

async function buildAuthRequestInit(apiBaseUrl: string, init: RequestInit): Promise<RequestInit> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  if (shouldAttachPublicCsrfHeader(init)) {
    const csrfToken = await ensurePublicCsrfToken(apiBaseUrl);

    if (csrfToken) {
      headers.set(PUBLIC_CSRF_HEADER_NAME, csrfToken);
    }
  }

  return {
    ...init,
    credentials: "include",
    headers
  };
}

function shouldAttachPublicCsrfHeader(init: RequestInit): boolean {
  const method = (init.method ?? "GET").toUpperCase();

  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

async function ensurePublicCsrfToken(apiBaseUrl: string): Promise<string | null> {
  if (cachedPublicCsrfToken) {
    return cachedPublicCsrfToken;
  }

  if (publicCsrfTokenPromise) {
    return publicCsrfTokenPromise;
  }

  publicCsrfTokenPromise = fetchPublicCsrfToken(apiBaseUrl).finally(() => {
    publicCsrfTokenPromise = null;
  });

  return publicCsrfTokenPromise;
}

async function fetchPublicCsrfToken(apiBaseUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/csrf`, {
      credentials: "include"
    });
    const body = await readApiResponse<{ csrfToken: string }>(response);

    if (!response.ok || !body.ok) {
      cachedPublicCsrfToken = null;
      return null;
    }

    cachedPublicCsrfToken = body.data.csrfToken;
    return cachedPublicCsrfToken;
  } catch {
    cachedPublicCsrfToken = null;
    return null;
  }
}

function unauthorizedResponse<T = AuthPayload>(): ApiResponse<T> {
  return {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication is required."
    }
  };
}

function apiUnavailableResponse<T = AuthPayload>(): ApiResponse<T> {
  return {
    ok: false,
    error: {
      code: "API_UNAVAILABLE",
      message: "BabyLoop API is unavailable."
    }
  };
}

async function readApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    const body: unknown = await response.json();

    if (isApiResponse<T>(body)) {
      return body;
    }
  } catch {
    return apiUnavailableResponse<T>();
  }

  return apiUnavailableResponse<T>();
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }

  if ((value as { ok?: unknown }).ok === true) {
    return "data" in value;
  }

  const error = (value as { error?: unknown }).error;

  return typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string";
}

function isSessionRejectionStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function markManuallyLoggedOut(): void {
  manuallyLoggedOut = true;
  lastRefreshFailureAt = 0;
  authSessionVersion += 1;
  refreshSessionPromise = null;
  fetchCurrentUserWithoutRefreshPromise = null;
  publicCsrfTokenPromise = null;
  cachedPublicCsrfToken = null;
  cachedCurrentAuth = null;
}

function isManuallyLoggedOut(): boolean {
  return manuallyLoggedOut;
}

function dispatchAuthEvent(eventName: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(eventName));
}

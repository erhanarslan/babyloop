import type { ApiResponse } from "@babyloop/shared";

export const AUTH_TOKEN_STORAGE_KEY = "babyloop_access_token";
export const AUTH_CHANGED_EVENT = "babyloop-auth-changed";
const AUTH_LOGGED_OUT_STORAGE_KEY = "babyloop_logged_out";

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
};

let refreshSessionPromise: Promise<ApiResponse<AuthPayload>> | null = null;
let authSessionVersion = 0;

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    window.localStorage?.removeItem(AUTH_LOGGED_OUT_STORAGE_KEY);
    window.localStorage?.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    return;
  }

  authSessionVersion += 1;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthToken(options: { broadcast?: boolean } = {}): void {
  let hadToken = false;
  const shouldBroadcast = options.broadcast ?? false;

  try {
    hadToken = window.localStorage?.getItem(AUTH_TOKEN_STORAGE_KEY) !== null;
    window.localStorage?.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return;
  }

  if (hadToken || shouldBroadcast) {
    authSessionVersion += 1;
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
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
    const body = (await response.json()) as ApiResponse<AuthPayload>;

    if (response.ok && body.ok) {
      if (
        !options.force &&
        (isManuallyLoggedOut() || options.startedSessionVersion !== authSessionVersion)
      ) {
        return unauthorizedResponse();
      }

      setAuthToken(body.data.accessToken);
      return body;
    }

    clearAuthToken();
    return body.ok ? unauthorizedResponse() : body;
  } catch {
    clearAuthToken();
    return {
      ok: false,
      error: {
        code: "API_UNAVAILABLE",
        message: "BabyLoop API is unavailable."
      }
    };
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

export async function authFetch(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const requestUrl = `${apiBaseUrl}${path}`;
  const response = await fetch(requestUrl, buildAuthRequestInit(init));

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSession(apiBaseUrl);

  if (!refreshed.ok) {
    return response;
  }

  return fetch(requestUrl, buildAuthRequestInit(init));
}

function buildAuthRequestInit(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers);
  const token = getAuthToken();

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return {
    ...init,
    credentials: "include",
    headers
  };
}

function unauthorizedResponse(): ApiResponse<AuthPayload> {
  return {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication is required."
    }
  };
}

function markManuallyLoggedOut(): void {
  authSessionVersion += 1;
  refreshSessionPromise = null;

  try {
    window.localStorage?.setItem(AUTH_LOGGED_OUT_STORAGE_KEY, "true");
  } catch {
    return;
  }
}

function isManuallyLoggedOut(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage?.getItem(AUTH_LOGGED_OUT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

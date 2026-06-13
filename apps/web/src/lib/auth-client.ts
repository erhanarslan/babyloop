import type { ApiResponse } from "@babyloop/shared";

export const AUTH_CHANGED_EVENT = "babyloop-auth-changed";
export const AUTH_SESSION_ENDED_EVENT = "babyloop-auth-session-ended";

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
let memoryAuthToken: string | null = null;
let manuallyLoggedOut = false;

export function getAuthToken(): string | null {
  return memoryAuthToken;
}

export function setAuthToken(token: string): void {
  memoryAuthToken = token;
  manuallyLoggedOut = false;
  authSessionVersion += 1;

  dispatchAuthEvent(AUTH_CHANGED_EVENT);
}

export function clearAuthToken(options: { broadcast?: boolean } = {}): void {
  const hadToken = memoryAuthToken !== null;
  const shouldBroadcast = options.broadcast ?? false;

  memoryAuthToken = null;

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

    clearAuthToken({ broadcast: true });
    return body.ok ? unauthorizedResponse() : body;
  } catch {
    clearAuthToken({ broadcast: true });
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
  manuallyLoggedOut = true;
  authSessionVersion += 1;
  refreshSessionPromise = null;
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

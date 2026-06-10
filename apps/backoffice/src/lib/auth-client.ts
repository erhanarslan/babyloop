import type { ApiResponse } from "@babyloop/shared";

export const BACKOFFICE_AUTH_TOKEN_STORAGE_KEY = "babyloop_backoffice_access_token";
export const BACKOFFICE_AUTH_CHANGED_EVENT = "babyloop-backoffice-auth-changed";

export type BackofficeAuthUser = {
  id: string;
  email: string;
  role: string;
  emailVerified?: boolean;
};

export type BackofficeAuthMe = {
  user: BackofficeAuthUser;
};

type LoginResponse = {
  accessToken: string;
  user: BackofficeAuthUser;
};

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(BACKOFFICE_AUTH_TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(BACKOFFICE_AUTH_TOKEN_STORAGE_KEY, token);
  window.dispatchEvent(new Event(BACKOFFICE_AUTH_CHANGED_EVENT));
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(BACKOFFICE_AUTH_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new Event(BACKOFFICE_AUTH_CHANGED_EVENT));
}

export async function loginBackoffice(
  apiBaseUrl: string,
  input: {
    email: string;
    password: string;
  },
): Promise<{ ok: true; auth: LoginResponse } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const body = (await response.json()) as ApiResponse<LoginResponse>;

    if (!response.ok || !body.ok) {
      return {
        ok: false,
        message: getApiErrorMessage(body, "Login failed."),
      };
    }

    setAuthToken(body.data.accessToken);

    return {
      ok: true,
      auth: body.data,
    };
  } catch {
    return {
      ok: false,
      message: "Login request failed.",
    };
  }
}

export async function logoutBackoffice(apiBaseUrl: string): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: buildAuthHeaders(),
    });
  } finally {
    clearAuthToken();
  }
}

export async function authFetch(
  apiBaseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const requestUrl = `${apiBaseUrl}${path}`;

  const firstResponse = await fetch(requestUrl, buildAuthRequestInit(init));

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  const refreshed = await refreshSession(apiBaseUrl);

  if (!refreshed) {
    clearAuthToken();
    return firstResponse;
  }

  return fetch(requestUrl, buildAuthRequestInit(init));
}

export async function fetchBackofficeMe(
  apiBaseUrl: string,
): Promise<BackofficeAuthMe | null> {
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/me");

  if (response.status === 401) {
    return null;
  }

  const body = (await response.json()) as ApiResponse<BackofficeAuthMe>;

  return response.ok && body.ok ? body.data : null;
}

async function refreshSession(apiBaseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    const body = (await response.json()) as ApiResponse<{ accessToken: string }>;

    if (!response.ok || !body.ok) {
      return false;
    }

    setAuthToken(body.data.accessToken);
    return true;
  } catch {
    return false;
  }
}

function buildAuthRequestInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    credentials: "include",
    headers: {
      ...buildAuthHeaders(),
      ...init?.headers,
    },
  };
}

function buildAuthHeaders(): HeadersInit {
  const token = getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

function getApiErrorMessage(body: ApiResponse<unknown>, fallback: string): string {
  if (body.ok) {
    return fallback;
  }

  return body.error?.message ?? fallback;
}

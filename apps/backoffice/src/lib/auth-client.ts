import type { ApiResponse } from "@babyloop/shared";

export const BACKOFFICE_AUTH_CHANGED_EVENT = "babyloop-backoffice-auth-changed";

const BACKOFFICE_CSRF_COOKIE_NAME = "babyloop_backoffice_csrf_token";
const BACKOFFICE_CSRF_HEADER_NAME = "x-babyloop-csrf-token";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let cachedBackofficeCsrfToken: string | null = null;

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
  user: BackofficeAuthUser;
};

type BackofficeCsrfResponse = {
  csrfToken: string;
};

export async function loginBackoffice(
  apiBaseUrl: string,
  input: {
    email: string;
    password: string;
  },
): Promise<{ ok: true; auth: LoginResponse } | { ok: false; message: string }> {
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
      };
    }

    if (!("user" in body.data)) {
      return {
        ok: false,
        message: "Additional verification is required before backoffice login.",
      };
    }

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
    };
  }
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
    clearBackofficeCsrfToken();
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
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/backoffice/me");

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  const body = (await response.json()) as ApiResponse<BackofficeAuthMe>;

  return response.ok && body.ok ? body.data : null;
}

async function refreshSession(apiBaseUrl: string): Promise<boolean> {
  try {
    clearBackofficeCsrfToken();

    const response = await fetch(`${apiBaseUrl}/api/v1/auth/backoffice/refresh`, {
      method: "POST",
      credentials: "include",
    });

    const body = (await response.json()) as ApiResponse<BackofficeAuthMe>;

    if (!response.ok || !body.ok) {
      return false;
    }

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

  if (!options.forceRefresh) {
    const cookieToken = readCsrfTokenFromDocumentCookie();

    if (cookieToken) {
      cachedBackofficeCsrfToken = cookieToken;
      return cookieToken;
    }
  }

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

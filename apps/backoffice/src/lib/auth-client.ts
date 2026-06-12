import type { ApiResponse } from "@babyloop/shared";

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
  user: BackofficeAuthUser;
};

export async function loginBackoffice(
  apiBaseUrl: string,
  input: {
    email: string;
    password: string;
  },
): Promise<{ ok: true; auth: LoginResponse } | { ok: false; message: string }> {
  try {
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
    await fetch(`${apiBaseUrl}/api/v1/auth/backoffice/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    dispatchAuthChanged();
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
    dispatchAuthChanged();
    return firstResponse;
  }

  return fetch(requestUrl, buildAuthRequestInit(init));
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
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/backoffice/refresh`, {
      method: "POST",
      credentials: "include",
    });

    const body = (await response.json()) as ApiResponse<BackofficeAuthMe>;

    if (!response.ok || !body.ok) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function buildAuthRequestInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    credentials: "include",
    headers: new Headers(init?.headers),
  };
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

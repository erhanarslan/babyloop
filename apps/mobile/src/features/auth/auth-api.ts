import { getApiBaseUrl } from "../../config/api";

const PUBLIC_CSRF_HEADER_NAME = "x-babyloop-csrf-token";

export type MobileAuthUser = {
  id: string;
  email: string;
  emailVerifiedAt?: string | null;
  role: string;
};

export type MobileAuthProfile = {
  id: string;
  displayName: string;
  locationCity: string | null;
};

export type MobileAuthPayload = {
  accessToken: string;
  user: MobileAuthUser;
  profile: MobileAuthProfile;
  devEmailVerificationToken?: string;
};

export type MobileAuthMe = {
  user: MobileAuthUser;
  profile: MobileAuthProfile;
};

export type MobileMfaChallenge = {
  challengeId: string;
  devOtpCode?: string;
  mfaRequired: true;
};

export type MobileApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type MobileApiSuccess<T> = {
  ok: true;
  data: T;
};

export type MobileApiResponse<T> = MobileApiSuccess<T> | MobileApiFailure;

export type MobileAuthMode = "login" | "register";

export type MobileAuthRequest = {
  email: string;
  password: string;
  displayName?: string;
  locationCity?: string;
};

let memoryAuthToken: string | null = null;
let cachedPublicCsrfToken: string | null = null;
let publicCsrfTokenPromise: Promise<string | null> | null = null;

export function getMobileAuthToken(): string | null {
  return memoryAuthToken;
}

export function setMobileAuthToken(token: string): void {
  memoryAuthToken = token;
}

export function clearMobileAuthToken(): void {
  memoryAuthToken = null;
  cachedPublicCsrfToken = null;
  publicCsrfTokenPromise = null;
}

export async function submitMobileAuthRequest(
  mode: MobileAuthMode,
  payload: MobileAuthRequest
): Promise<MobileApiResponse<MobileAuthPayload | MobileMfaChallenge>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/${mode}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await parseApiResponse<MobileAuthPayload | MobileMfaChallenge>(response);

    if (body.ok && "accessToken" in body.data) {
      setMobileAuthToken(body.data.accessToken);
    }

    return body;
  } catch {
    return apiUnavailableResponse();
  }
}

export async function fetchMobileCurrentUser(): Promise<MobileApiResponse<MobileAuthMe>> {
  try {
    const response = await mobileAuthFetch("/api/v1/auth/me");

    return parseApiResponse<MobileAuthMe>(response);
  } catch {
    return apiUnavailableResponse();
  }
}

export async function refreshMobileSession(): Promise<MobileApiResponse<MobileAuthPayload>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include"
    });

    const body = await parseApiResponse<MobileAuthPayload>(response);

    if (body.ok) {
      setMobileAuthToken(body.data.accessToken);
    } else {
      clearMobileAuthToken();
    }

    return body;
  } catch {
    clearMobileAuthToken();
    return apiUnavailableResponse();
  }
}

export async function logoutMobileSession(): Promise<void> {
  clearMobileAuthToken();

  try {
    await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
  } catch {
    return;
  }
}

export async function mobileAuthFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const requestUrl = `${getApiBaseUrl()}${path}`;
  const firstResponse = await fetch(requestUrl, await buildMobileAuthRequestInit(init));

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  const refreshed = await refreshMobileSession();

  if (!refreshed.ok) {
    return firstResponse;
  }

  return fetch(requestUrl, await buildMobileAuthRequestInit(init));
}

async function buildMobileAuthRequestInit(init: RequestInit): Promise<RequestInit> {
  const headers = new Headers(init.headers);
  const token = getMobileAuthToken();

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  if (shouldAttachPublicCsrfHeader(init)) {
    const csrfToken = await ensurePublicCsrfToken();

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

async function ensurePublicCsrfToken(): Promise<string | null> {
  if (cachedPublicCsrfToken) {
    return cachedPublicCsrfToken;
  }

  if (publicCsrfTokenPromise) {
    return publicCsrfTokenPromise;
  }

  publicCsrfTokenPromise = fetchPublicCsrfToken().finally(() => {
    publicCsrfTokenPromise = null;
  });

  return publicCsrfTokenPromise;
}

async function fetchPublicCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/csrf`, {
      credentials: "include"
    });

    const body = await parseApiResponse<{ csrfToken: string }>(response);

    if (!body.ok) {
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

async function parseApiResponse<T>(response: Response): Promise<MobileApiResponse<T>> {
  const payload: unknown = await response.json().catch(() => null);

  if (isApiResponse<T>(payload)) {
    return payload;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: `HTTP_${response.status}`,
        message: `Request failed with status ${response.status}.`
      }
    };
  }

  return {
    ok: false,
    error: {
      code: "INVALID_API_RESPONSE",
      message: "BabyLoop API returned an invalid response."
    }
  };
}

function apiUnavailableResponse<T>(): MobileApiResponse<T> {
  return {
    ok: false,
    error: {
      code: "API_UNAVAILABLE",
      message: "BabyLoop API bağlantısı kurulamadı. API çalışıyor mu ve mobil API base URL doğru mu kontrol et."
    }
  };
}

function isApiResponse<T>(value: unknown): value is MobileApiResponse<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok === true) {
    return "data" in value;
  }

  return isRecord(value.error) && typeof value.error.message === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { getApiBaseUrl } from "../../config/api";
import {
  clearStoredMobileAuthToken,
  getStoredMobileAuthToken,
  setStoredMobileAuthToken
} from "./auth-token-storage";

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

export type MobileMfaVerifyRequest = {
  challengeId: string;
  code: string;
};

export type MobileMfaStatus = {
  delivery: "email";
  method: "email_otp";
  mfaEnabled: boolean;
};

export type MobileMfaPreferencePayload = MobileMfaStatus & {
  updated: true;
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

export type MobileMfaPreferenceRequest = {
  currentPassword: string;
};

export type MobileAuthSession = {
  id: string;
  current: boolean;
  deviceLabel: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type MobileAuthSessionsPayload = {
  currentSessionId: string | null;
  sessions: MobileAuthSession[];
};

export type MobileAuthSessionRevokePayload = {
  currentSessionRevoked: boolean;
  revoked: true;
  sessionId: string;
};

export type MobileAuthSessionsRevokeAllPayload = {
  revokedCount: number;
};

let memoryAuthToken: string | null = null;
let cachedPublicCsrfToken: string | null = null;
let publicCsrfTokenPromise: Promise<string | null> | null = null;

export function getMobileAuthToken(): string | null {
  return memoryAuthToken;
}

export async function hydrateMobileAuthToken(): Promise<string | null> {
  if (memoryAuthToken) {
    return memoryAuthToken;
  }

  const storedToken = await getStoredMobileAuthToken();

  if (storedToken) {
    memoryAuthToken = storedToken;
  }

  return memoryAuthToken;
}

export function setMobileAuthToken(token: string): void {
  memoryAuthToken = token;
  void setStoredMobileAuthToken(token);
}

export function clearMobileAuthToken(): void {
  memoryAuthToken = null;
  cachedPublicCsrfToken = null;
  publicCsrfTokenPromise = null;
  void clearStoredMobileAuthToken();
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

export async function verifyMobileMfaLogin(
  payload: MobileMfaVerifyRequest
): Promise<MobileApiResponse<MobileAuthPayload>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/mfa/verify`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await parseApiResponse<MobileAuthPayload>(response);

    if (body.ok) {
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

export async function fetchMobileMfaStatus(): Promise<MobileApiResponse<MobileMfaStatus>> {
  try {
    const response = await mobileAuthFetch("/api/v1/auth/mfa/status");

    return parseApiResponse<MobileMfaStatus>(response);
  } catch {
    return apiUnavailableResponse();
  }
}

export async function enableMobileMfa(
  payload: MobileMfaPreferenceRequest
): Promise<MobileApiResponse<MobileMfaPreferencePayload>> {
  return submitMobileMfaPreference("/api/v1/auth/mfa/enable", payload);
}

export async function disableMobileMfa(
  payload: MobileMfaPreferenceRequest
): Promise<MobileApiResponse<MobileMfaPreferencePayload>> {
  return submitMobileMfaPreference("/api/v1/auth/mfa/disable", payload);
}

export async function fetchMobileAuthSessions(): Promise<MobileApiResponse<MobileAuthSessionsPayload>> {
  try {
    const response = await mobileAuthFetch("/api/v1/auth/sessions");

    return parseApiResponse<MobileAuthSessionsPayload>(response);
  } catch {
    return mobileApiUnavailable();
  }
}

export async function revokeMobileAuthSession(
  sessionId: string
): Promise<MobileApiResponse<MobileAuthSessionRevokePayload>> {
  try {
    const response = await mobileAuthFetch(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {
      method: "POST"
    });

    return parseApiResponse<MobileAuthSessionRevokePayload>(response);
  } catch {
    return mobileApiUnavailable();
  }
}

export async function revokeAllMobileAuthSessions(): Promise<MobileApiResponse<MobileAuthSessionsRevokeAllPayload>> {
  try {
    const response = await mobileAuthFetch("/api/v1/auth/sessions/revoke-all", {
      method: "POST"
    });

    return parseApiResponse<MobileAuthSessionsRevokeAllPayload>(response);
  } catch {
    return mobileApiUnavailable();
  }
}

async function submitMobileMfaPreference(
  path: string,
  payload: MobileMfaPreferenceRequest
): Promise<MobileApiResponse<MobileMfaPreferencePayload>> {
  try {
    const response = await mobileAuthFetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return parseApiResponse<MobileMfaPreferencePayload>(response);
  } catch {
    return apiUnavailableResponse();
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
  const token = await hydrateMobileAuthToken();

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

function mobileApiUnavailable<T>(): MobileApiResponse<T> {
  return {
    ok: false,
    error: {
      code: "API_UNAVAILABLE",
      message: "API is unavailable."
    }
  };
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

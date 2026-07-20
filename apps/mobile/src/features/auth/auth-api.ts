import { getApiBaseUrl } from "../../config/api";
import {
  clearStoredMobileAuthToken,
  getStoredMobileAuthToken,
  setStoredMobileAuthToken
} from "./auth-token-storage";

const PUBLIC_CSRF_HEADER_NAME = "x-babyloop-csrf-token";
const MOBILE_CLIENT_HEADER_NAME = "x-babyloop-client";
const MOBILE_CLIENT_HEADER_VALUE = "mobile";

function withMobileClientHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set(MOBILE_CLIENT_HEADER_NAME, MOBILE_CLIENT_HEADER_VALUE);
  return headers;
}

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

export type MobileLoginApprovalRequiredPayload = {
  approvalId: string;
  approvalToken: string;
  deviceLabel: string;
  expiresAt: string;
  loginApprovalRequired: true;
};

export type MobileAuthSubmitPayload =
  | MobileAuthPayload
  | MobileMfaChallenge
  | MobileLoginApprovalRequiredPayload;

export type MobileMfaVerifyPayload =
  | MobileAuthPayload
  | MobileLoginApprovalRequiredPayload;

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

export type MobileLoginApprovalStatus = {
  delivery: "in_app";
  method: "mobile_approval";
  mobileLoginApprovalEnabled: boolean;
};

export type MobileLoginApprovalPreferencePayload = MobileLoginApprovalStatus & {
  updated: true;
};

export type MobileLoginApprovalPreferenceRequest = {
  currentPassword: string;
};

export type MobileLoginApprovalChallenge = {
  id: string;
  status: "pending" | "approved" | "denied" | "expired";
  deviceLabel: string;
  requestUserAgent: string | null;
  requestIpAddress: string | null;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
};

export type MobileLoginApprovalsPayload = {
  approvals: MobileLoginApprovalChallenge[];
};

export type MobileLoginApprovalActionPayload = {
  approvalId: string;
  resolved: true;
  status: "approved" | "denied";
};

export type MobilePasswordChangeRequest = {
  currentPassword: string;
  newPassword: string;
};

export type MobilePasswordChangePayload = {
  passwordChanged: true;
};

export type MobileAccountDeletionRequest = {
  currentPassword?: string;
};

export type MobileAccountDeletionRequestPayload = {
  challengeId: string;
  expiresAt: string;
  passwordRequired: boolean;
  requested: true;
};

export type MobileAccountDeletionConfirmRequest = {
  challengeId: string;
  code: string;
  confirmation: "HESABIMI SİL";
};

export type MobileAccountDeletionConfirmPayload = {
  accountDeleted: true;
  profileId: string;
  storageCleanup: {
    completedCount: number;
    failedCount: number;
    pendingCount: number;
  };
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
let mobileSessionRefreshPromise: Promise<MobileApiResponse<MobileAuthPayload>> | null = null;

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
): Promise<MobileApiResponse<MobileAuthSubmitPayload>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/${mode}`, {
      method: "POST",
      credentials: "include",
      headers: withMobileClientHeaders({
        "content-type": "application/json"
      }),
      body: JSON.stringify(mode === "login" ? { ...payload, clientType: "mobile" } : payload)
    });

    const body = await parseApiResponse<MobileAuthSubmitPayload>(response);

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
): Promise<MobileApiResponse<MobileMfaVerifyPayload>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/mfa/verify`, {
      method: "POST",
      credentials: "include",
      headers: withMobileClientHeaders({
        "content-type": "application/json"
      }),
      body: JSON.stringify(payload)
    });

    const body = await parseApiResponse<MobileMfaVerifyPayload>(response);

    if (body.ok && "accessToken" in body.data) {
      setMobileAuthToken(body.data.accessToken);
    }

    return body;
  } catch {
    return apiUnavailableResponse();
  }
}

export async function completeMobileLoginApproval(
  approvalToken: string
): Promise<MobileApiResponse<MobileAuthPayload>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/login-approval/complete`, {
      method: "POST",
      credentials: "include",
      headers: withMobileClientHeaders({
        "content-type": "application/json"
      }),
      body: JSON.stringify({ approvalToken })
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

export function refreshMobileSession(): Promise<MobileApiResponse<MobileAuthPayload>> {
  if (mobileSessionRefreshPromise) {
    return mobileSessionRefreshPromise;
  }

  mobileSessionRefreshPromise = performMobileSessionRefresh().finally(() => {
    mobileSessionRefreshPromise = null;
  });

  return mobileSessionRefreshPromise;
}

async function performMobileSessionRefresh(): Promise<MobileApiResponse<MobileAuthPayload>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: withMobileClientHeaders()
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

export async function changeMobilePassword(
  payload: MobilePasswordChangeRequest
): Promise<MobileApiResponse<MobilePasswordChangePayload>> {
  try {
    const response = await mobileAuthFetch("/api/v1/auth/password/change", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return parseApiResponse<MobilePasswordChangePayload>(response);
  } catch {
    return apiUnavailableResponse();
  }
}

export async function requestMobileAccountDeletion(
  payload: MobileAccountDeletionRequest
): Promise<MobileApiResponse<MobileAccountDeletionRequestPayload>> {
  try {
    const currentPassword = payload.currentPassword?.trim();
    const response = await mobileAuthFetch("/api/v1/auth/account-deletion/request", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(currentPassword ? { currentPassword } : {})
    });

    return parseApiResponse<MobileAccountDeletionRequestPayload>(response);
  } catch {
    return apiUnavailableResponse();
  }
}

export async function confirmMobileAccountDeletion(
  payload: MobileAccountDeletionConfirmRequest
): Promise<MobileApiResponse<MobileAccountDeletionConfirmPayload>> {
  try {
    const response = await mobileAuthFetch("/api/v1/auth/account-deletion/confirm", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const body = await parseApiResponse<MobileAccountDeletionConfirmPayload>(response);

    if (body.ok) {
      clearMobileAuthToken();
    }

    return body;
  } catch {
    return apiUnavailableResponse();
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

export async function fetchMobileLoginApprovalStatus(): Promise<MobileApiResponse<MobileLoginApprovalStatus>> {
  try {
    const response = await mobileAuthFetch("/api/v1/auth/login-approval/status");

    return parseApiResponse<MobileLoginApprovalStatus>(response);
  } catch {
    return apiUnavailableResponse();
  }
}

export async function enableMobileLoginApproval(
  payload: MobileLoginApprovalPreferenceRequest
): Promise<MobileApiResponse<MobileLoginApprovalPreferencePayload>> {
  return submitMobileLoginApprovalPreference("/api/v1/auth/login-approval/enable", payload);
}

export async function disableMobileLoginApproval(
  payload: MobileLoginApprovalPreferenceRequest
): Promise<MobileApiResponse<MobileLoginApprovalPreferencePayload>> {
  return submitMobileLoginApprovalPreference("/api/v1/auth/login-approval/disable", payload);
}

export async function fetchMobileLoginApprovals(): Promise<MobileApiResponse<MobileLoginApprovalsPayload>> {
  try {
    const response = await mobileAuthFetch("/api/v1/auth/login-approvals");

    return parseApiResponse<MobileLoginApprovalsPayload>(response);
  } catch {
    return mobileApiUnavailable();
  }
}

export async function approveMobileLoginApproval(
  approvalId: string
): Promise<MobileApiResponse<MobileLoginApprovalActionPayload>> {
  return submitMobileLoginApprovalAction(approvalId, "approve");
}

export async function denyMobileLoginApproval(
  approvalId: string
): Promise<MobileApiResponse<MobileLoginApprovalActionPayload>> {
  return submitMobileLoginApprovalAction(approvalId, "deny");
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

async function submitMobileLoginApprovalPreference(
  path: string,
  payload: MobileLoginApprovalPreferenceRequest
): Promise<MobileApiResponse<MobileLoginApprovalPreferencePayload>> {
  try {
    const response = await mobileAuthFetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return parseApiResponse<MobileLoginApprovalPreferencePayload>(response);
  } catch {
    return apiUnavailableResponse();
  }
}

async function submitMobileLoginApprovalAction(
  approvalId: string,
  action: "approve" | "deny"
): Promise<MobileApiResponse<MobileLoginApprovalActionPayload>> {
  try {
    const response = await mobileAuthFetch(
      `/api/v1/auth/login-approvals/${encodeURIComponent(approvalId)}/${action}`,
      {
        method: "POST"
      }
    );

    return parseApiResponse<MobileLoginApprovalActionPayload>(response);
  } catch {
    return mobileApiUnavailable();
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
  const headers = withMobileClientHeaders(init.headers);
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

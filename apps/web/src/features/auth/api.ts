"use client";

import { CURRENT_TERMS_VERSION, type ApiResponse } from "@babyloop/shared";
import { authFetch, type AuthMe, type AuthPayload } from "../../lib/auth-client";

export type AuthMode = "login" | "register";

type AuthRequest = {
  email: string;
  password: string;
  displayName?: string;
  locationCity?: string;
  termsAccepted?: true;
  termsVersion?: typeof CURRENT_TERMS_VERSION;
};

export type PasswordResetRequestPayload = {
  requested: true;
  devResetToken?: string;
};

export type PasswordResetConfirmPayload = {
  passwordReset: true;
};

export type PasswordChangePayload = {
  passwordChanged: true;
};

export type MfaStatusPayload = {
  delivery: "email";
  method: "email_otp";
  mfaEnabled: boolean;
};

export type MfaPreferencePayload = MfaStatusPayload & {
  updated: true;
};

export type AuthSessionPayload = {
  id: string;
  current: boolean;
  deviceLabel: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type AuthSessionsPayload = {
  currentSessionId: string | null;
  sessions: AuthSessionPayload[];
};

export type AuthSessionRevokePayload = {
  currentSessionRevoked: boolean;
  revoked: true;
  sessionId: string;
};

export type AuthSessionsRevokeAllPayload = {
  revokedCount: number;
};

export type EmailVerificationRequestPayload = {
  requested: true;
  devEmailVerificationToken?: string;
};

export type EmailVerificationConfirmPayload = {
  emailVerified: true;
};

export type LoginApprovalRequiredPayload = {
  approvalId: string;
  approvalToken: string;
  deviceLabel: string;
  expiresAt: string;
  loginApprovalRequired: true;
};

export type MfaRequiredPayload = {
  challengeId: string;
  devOtpCode?: string;
  mfaRequired: true;
};

export type LoginApprovalCompletePendingPayload = {
  loginApprovalPending: true;
  status: "pending";
  expiresAt: string;
};

export type LoginApprovalCompletePayload = AuthPayload | LoginApprovalCompletePendingPayload;

export function isLoginApprovalCompletePendingPayload(
  payload: LoginApprovalCompletePayload
): payload is LoginApprovalCompletePendingPayload {
  return "loginApprovalPending" in payload;
}

export type AuthSubmitPayload = AuthPayload | LoginApprovalRequiredPayload | MfaRequiredPayload;

export type AuthSubmitResponse = ApiResponse<AuthSubmitPayload> & {
  httpStatus: number;
  retryAfterSeconds: number | null;
};

const authMutationFlights = new Map<string, Promise<unknown>>();

export async function submitAuthRequest(
  apiBaseUrl: string,
  mode: AuthMode,
  payload: AuthRequest
): Promise<AuthSubmitResponse> {
  return runAuthMutationSingleFlight(
    `${apiBaseUrl}/api/v1/auth/${mode}`,
    payload,
    () => submitAuthRequestOnce(apiBaseUrl, mode, payload),
  );
}

async function submitAuthRequestOnce(
  apiBaseUrl: string,
  mode: AuthMode,
  payload: AuthRequest,
): Promise<AuthSubmitResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/${mode}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json() as ApiResponse<AuthSubmitPayload>;
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;

  return Object.assign(body, {
    httpStatus: response.status,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : null,
  });
}

export async function verifyMfaLogin(
  apiBaseUrl: string,
  challengeId: string,
  code: string
): Promise<ApiResponse<AuthPayload | LoginApprovalRequiredPayload>> {
  return postAuthJsonSingleFlight(apiBaseUrl, "/api/v1/auth/mfa/verify", { challengeId, code });
}

export async function completeLoginApproval(
  apiBaseUrl: string,
  approvalToken: string
): Promise<ApiResponse<LoginApprovalCompletePayload>> {
  return postAuthJsonSingleFlight(apiBaseUrl, "/api/v1/auth/login-approval/complete", { approvalToken });
}

export async function fetchCurrentUser(apiBaseUrl: string): Promise<ApiResponse<AuthMe>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/me");

  return response.json() as Promise<ApiResponse<AuthMe>>;
}

export async function startGoogleLogin(
  apiBaseUrl: string,
  legal?: { termsAccepted: true; termsVersion: typeof CURRENT_TERMS_VERSION }
): Promise<ApiResponse<{ started: true }>> {
  const url = new URL(`${apiBaseUrl}/api/v1/auth/google/start`);

  if (legal) {
    url.searchParams.set("termsAccepted", "true");
    url.searchParams.set("termsVersion", legal.termsVersion);
  }

  const startUrl = url.toString();
  const response = await fetch(startUrl, {
    credentials: "include",
    redirect: "manual"
  });

  if (response.status === 503) {
    return response.json() as Promise<ApiResponse<{ started: true }>>;
  }

  window.location.assign(startUrl);

  return {
    ok: true,
    data: {
      started: true
    }
  };
}

export async function requestPasswordReset(
  apiBaseUrl: string,
  email: string
): Promise<ApiResponse<PasswordResetRequestPayload>> {
  return postAuthJsonSingleFlight(apiBaseUrl, "/api/v1/auth/password-reset/request", { email });
}

export async function confirmPasswordReset(
  apiBaseUrl: string,
  token: string,
  newPassword: string
): Promise<ApiResponse<PasswordResetConfirmPayload>> {
  return postAuthJsonSingleFlight(apiBaseUrl, "/api/v1/auth/password-reset/confirm", { token, newPassword });
}

export async function changePassword(
  apiBaseUrl: string,
  currentPassword: string,
  newPassword: string
): Promise<ApiResponse<PasswordChangePayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/password/change", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });

  return response.json() as Promise<ApiResponse<PasswordChangePayload>>;
}

export async function fetchMfaStatus(apiBaseUrl: string): Promise<ApiResponse<MfaStatusPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/mfa/status");

  return response.json() as Promise<ApiResponse<MfaStatusPayload>>;
}

export async function enableMfa(
  apiBaseUrl: string,
  currentPassword: string
): Promise<ApiResponse<MfaPreferencePayload>> {
  return submitMfaPreference(apiBaseUrl, "/api/v1/auth/mfa/enable", currentPassword);
}

export async function disableMfa(
  apiBaseUrl: string,
  currentPassword: string
): Promise<ApiResponse<MfaPreferencePayload>> {
  return submitMfaPreference(apiBaseUrl, "/api/v1/auth/mfa/disable", currentPassword);
}

async function submitMfaPreference(
  apiBaseUrl: string,
  path: string,
  currentPassword: string
): Promise<ApiResponse<MfaPreferencePayload>> {
  const response = await authFetch(apiBaseUrl, path, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ currentPassword })
  });

  return response.json() as Promise<ApiResponse<MfaPreferencePayload>>;
}

export async function requestEmailVerification(
  apiBaseUrl: string,
  email: string
): Promise<ApiResponse<EmailVerificationRequestPayload>> {
  return postAuthJsonSingleFlight(apiBaseUrl, "/api/v1/auth/email-verification/request", { email });
}

export async function confirmEmailVerification(
  apiBaseUrl: string,
  token: string
): Promise<ApiResponse<EmailVerificationConfirmPayload>> {
  return postAuthJsonSingleFlight(apiBaseUrl, "/api/v1/auth/email-verification/confirm", { token });
}

async function postAuthJsonSingleFlight<T>(
  apiBaseUrl: string,
  path: string,
  payload: unknown,
): Promise<ApiResponse<T>> {
  const url = `${apiBaseUrl}${path}`;
  return runAuthMutationSingleFlight(url, payload, async () => {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return response.json() as Promise<ApiResponse<T>>;
  });
}

async function runAuthMutationSingleFlight<T>(
  url: string,
  payload: unknown,
  operation: () => Promise<T>,
): Promise<T> {
  const flightKey = `${url}:${await fingerprintAuthPayload(payload)}`;
  const existingFlight = authMutationFlights.get(flightKey) as Promise<T> | undefined;
  if (existingFlight) return existingFlight;

  const flight = operation().finally(() => {
    authMutationFlights.delete(flightKey);
  });
  authMutationFlights.set(flightKey, flight);
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


export async function fetchAuthSessions(apiBaseUrl: string): Promise<ApiResponse<AuthSessionsPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/sessions");

  return response.json() as Promise<ApiResponse<AuthSessionsPayload>>;
}

export async function revokeAuthSessionRequest(
  apiBaseUrl: string,
  sessionId: string
): Promise<ApiResponse<AuthSessionRevokePayload>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {
    method: "POST"
  });

  return response.json() as Promise<ApiResponse<AuthSessionRevokePayload>>;
}

export async function revokeAllAuthSessionsRequest(
  apiBaseUrl: string,
  currentPassword: string
): Promise<ApiResponse<AuthSessionsRevokeAllPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/sessions/revoke-all", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ currentPassword })
  });

  return response.json() as Promise<ApiResponse<AuthSessionsRevokeAllPayload>>;
}

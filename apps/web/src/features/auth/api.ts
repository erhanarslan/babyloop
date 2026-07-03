"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authFetch, type AuthMe, type AuthPayload } from "../../lib/auth-client";

export type AuthMode = "login" | "register";

type AuthRequest = {
  email: string;
  password: string;
  displayName?: string;
  locationCity?: string;
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

export type EmailVerificationRequestPayload = {
  requested: true;
  devEmailVerificationToken?: string;
};

export type EmailVerificationConfirmPayload = {
  emailVerified: true;
};

export async function submitAuthRequest(
  apiBaseUrl: string,
  mode: AuthMode,
  payload: AuthRequest
): Promise<ApiResponse<AuthPayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/${mode}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<ApiResponse<AuthPayload>>;
}

export async function fetchCurrentUser(apiBaseUrl: string): Promise<ApiResponse<AuthMe>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/me");

  return response.json() as Promise<ApiResponse<AuthMe>>;
}

export async function startGoogleLogin(apiBaseUrl: string): Promise<ApiResponse<{ started: true }>> {
  const startUrl = `${apiBaseUrl}/api/v1/auth/google/start`;
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
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/password-reset/request`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ email })
  });

  return response.json() as Promise<ApiResponse<PasswordResetRequestPayload>>;
}

export async function confirmPasswordReset(
  apiBaseUrl: string,
  token: string,
  newPassword: string
): Promise<ApiResponse<PasswordResetConfirmPayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/password-reset/confirm`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ token, newPassword })
  });

  return response.json() as Promise<ApiResponse<PasswordResetConfirmPayload>>;
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
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/email-verification/request`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ email })
  });

  return response.json() as Promise<ApiResponse<EmailVerificationRequestPayload>>;
}

export async function confirmEmailVerification(
  apiBaseUrl: string,
  token: string
): Promise<ApiResponse<EmailVerificationConfirmPayload>> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/email-verification/confirm`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ token })
  });

  return response.json() as Promise<ApiResponse<EmailVerificationConfirmPayload>>;
}

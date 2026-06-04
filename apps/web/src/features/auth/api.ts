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

export function startGoogleLogin(apiBaseUrl: string): void {
  window.location.assign(`${apiBaseUrl}/api/v1/auth/google/start`);
}

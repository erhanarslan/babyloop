"use client";

import type { ApiResponse } from "@babyloop/shared";

export type AuthMode = "login" | "register";

export type AuthPayload = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
  profile: {
    id: string;
    displayName: string;
    locationCity: string | null;
  };
};

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
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<ApiResponse<AuthPayload>>;
}


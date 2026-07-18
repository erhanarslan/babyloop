import type { ApiResponse } from "@babyloop/shared";

import { authFetch } from "../../lib/auth-client";

export type AccountDeletionRequestPayload = {
  challengeId: string;
  expiresAt: string;
  passwordRequired: boolean;
  requested: true;
};

export type AccountDeletionConfirmPayload = {
  accountDeleted: true;
  profileId: string;
  storageCleanup: {
    completedCount: number;
    failedCount: number;
    pendingCount: number;
  };
};

export async function requestAccountDeletion(
  apiBaseUrl: string,
  currentPassword: string
): Promise<ApiResponse<AccountDeletionRequestPayload>> {
  try {
    const normalizedPassword = currentPassword.trim();
    const response = await authFetch(apiBaseUrl, "/api/v1/auth/account-deletion/request", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(
        normalizedPassword ? { currentPassword } : {}
      )
    });

    return readAccountDeletionResponse<AccountDeletionRequestPayload>(response);
  } catch {
    return apiUnavailableResponse();
  }
}

export async function confirmAccountDeletion(
  apiBaseUrl: string,
  input: {
    challengeId: string;
    code: string;
    confirmation: "HESABIMI SİL";
  }
): Promise<ApiResponse<AccountDeletionConfirmPayload>> {
  try {
    const response = await authFetch(apiBaseUrl, "/api/v1/auth/account-deletion/confirm", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });

    return readAccountDeletionResponse<AccountDeletionConfirmPayload>(response);
  } catch {
    return apiUnavailableResponse();
  }
}

async function readAccountDeletionResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const payload: unknown = await response.json().catch(() => null);

  if (isApiResponse<T>(payload)) {
    return payload;
  }

  return apiUnavailableResponse();
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }

  if ((value as { ok?: unknown }).ok === true) {
    return "data" in value;
  }

  const error = (value as { error?: unknown }).error;

  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

function apiUnavailableResponse<T>(): ApiResponse<T> {
  return {
    ok: false,
    error: {
      code: "API_UNAVAILABLE",
      message: "BabyLoop API is unavailable."
    }
  };
}

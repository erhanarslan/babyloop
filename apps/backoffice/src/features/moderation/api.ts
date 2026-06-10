import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type AdminModerationCaseStatus =
  | "pending"
  | "in_review"
  | "resolved"
  | "dismissed";

export type AdminModerationActionType =
  | "note"
  | "review_started"
  | "dismissed"
  | "resolved"
  | "action_taken";

export type AdminModerationCase = {
  id: string;
  status: AdminModerationCaseStatus;
  subjectType: string;
  subjectId: string;
  reason: string;
  details: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminModerationAction = {
  id: string;
  type?: AdminModerationActionType;
  actionType?: AdminModerationActionType;
  note: string | null;
  adminUserId: string | null;
  createdAt: string;
};

export type AdminModerationCaseDetail = AdminModerationCase & {
  actions: AdminModerationAction[];
};

export type ListAdminModerationCasesParams = {
  status?: AdminModerationCaseStatus;
};

export type ListAdminModerationCasesResponse = {
  cases: AdminModerationCase[];
};

export type GetAdminModerationCaseResponse = {
  case: AdminModerationCaseDetail;
};

export type UpdateAdminModerationCaseStatusInput = {
  status: AdminModerationCaseStatus;
};

export type UpdateAdminModerationCaseStatusResponse = {
  case: AdminModerationCaseDetail;
};

export type CreateAdminModerationCaseActionInput = {
  type: AdminModerationActionType;
  note: string;
};

export type CreateAdminModerationCaseActionResponse = {
  case: AdminModerationCaseDetail;
};

const ADMIN_MODERATION_BASE_PATH = "/api/v1/admin/moderation";

export async function listAdminModerationCases(
  params?: ListAdminModerationCasesParams,
): Promise<ApiResponse<ListAdminModerationCasesResponse>> {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.set("status", params.status);
  }

  const query = searchParams.toString();
  const path = `${ADMIN_MODERATION_BASE_PATH}/cases${query ? `?${query}` : ""}`;

  return adminRequest<ListAdminModerationCasesResponse>(path);
}

export async function getAdminModerationCase(
  caseId: string,
): Promise<ApiResponse<GetAdminModerationCaseResponse>> {
  return adminRequest<GetAdminModerationCaseResponse>(
    `${ADMIN_MODERATION_BASE_PATH}/cases/${caseId}`,
  );
}

export async function updateAdminModerationCaseStatus(
  caseId: string,
  input: UpdateAdminModerationCaseStatusInput,
): Promise<ApiResponse<UpdateAdminModerationCaseStatusResponse>> {
  return adminRequest<UpdateAdminModerationCaseStatusResponse>(
    `${ADMIN_MODERATION_BASE_PATH}/cases/${caseId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function createAdminModerationCaseAction(
  caseId: string,
  input: CreateAdminModerationCaseActionInput,
): Promise<ApiResponse<CreateAdminModerationCaseActionResponse>> {
  return adminRequest<CreateAdminModerationCaseActionResponse>(
    `${ADMIN_MODERATION_BASE_PATH}/cases/${caseId}/actions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

async function adminRequest<TData>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<TData>> {
  try {
    const response = await authFetch(getApiBaseUrl(), path, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    const body = (await response.json()) as ApiResponse<TData>;

    return body;
  } catch {
    return {
      ok: false,
      error: {
        code: "BACKOFFICE_REQUEST_FAILED",
        message: "Backoffice request failed.",
      },
    };
  }
}

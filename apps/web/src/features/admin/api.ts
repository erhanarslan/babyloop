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

export type AdminModerationSubjectType =
  | "listing"
  | "profile"
  | "message"
  | string;

export type AdminModerationCaseSummary = {
  id: string;
  status: AdminModerationCaseStatus;
  subjectType: AdminModerationSubjectType;
  subjectId: string;
  reason?: string | null;
  details?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminModerationAction = {
  id: string;
  caseId: string;
  type: AdminModerationActionType;
  note?: string | null;
  createdAt?: string;
  createdByUserId?: string | null;
};

export type AdminModerationCaseDetail = AdminModerationCaseSummary & {
  actions?: AdminModerationAction[];
  report?: unknown;
  subject?: unknown;
};

export type AdminModerationCaseListPayload = {
  cases: AdminModerationCaseSummary[];
};

export type AdminModerationCaseDetailPayload = {
  case: AdminModerationCaseDetail;
};

export type UpdateAdminModerationCaseStatusInput = {
  status: AdminModerationCaseStatus;
};

export type CreateAdminModerationCaseActionInput = {
  type: AdminModerationActionType;
  note: string;
};

const ADMIN_MODERATION_BASE_PATH = "/api/v1/admin/moderation";

function buildQuery(params?: {
  status?: AdminModerationCaseStatus;
}): string {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();

  if (params.status) {
    searchParams.set("status", params.status);
  }

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

async function adminRequest<TData>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<TData>> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const headers = new Headers(init.headers);

    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await authFetch(apiBaseUrl, path, {
      ...init,
      headers,
    });

    const body = (await response.json()) as ApiResponse<TData>;

    if (!response.ok && body.ok) {
      return {
        ok: false,
        error: {
          code: "API_ERROR",
          message: "API request failed.",
        },
      };
    }

    return body;
  } catch {
    return {
      ok: false,
      error: {
        code: "API_UNAVAILABLE",
        message: "BabyLoop API is unavailable.",
      },
    };
  }
}

export function listAdminModerationCases(params?: {
  status?: AdminModerationCaseStatus;
}): Promise<ApiResponse<AdminModerationCaseListPayload>> {
  return adminRequest<AdminModerationCaseListPayload>(
    `${ADMIN_MODERATION_BASE_PATH}/cases${buildQuery(params)}`,
    {
      method: "GET",
    },
  );
}

export function getAdminModerationCase(
  caseId: string,
): Promise<ApiResponse<AdminModerationCaseDetailPayload>> {
  return adminRequest<AdminModerationCaseDetailPayload>(
    `${ADMIN_MODERATION_BASE_PATH}/cases/${caseId}`,
    {
      method: "GET",
    },
  );
}

export function updateAdminModerationCaseStatus(
  caseId: string,
  input: UpdateAdminModerationCaseStatusInput,
): Promise<ApiResponse<AdminModerationCaseDetailPayload>> {
  return adminRequest<AdminModerationCaseDetailPayload>(
    `${ADMIN_MODERATION_BASE_PATH}/cases/${caseId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function createAdminModerationCaseAction(
  caseId: string,
  input: CreateAdminModerationCaseActionInput,
): Promise<ApiResponse<AdminModerationCaseDetailPayload>> {
  return adminRequest<AdminModerationCaseDetailPayload>(
    `${ADMIN_MODERATION_BASE_PATH}/cases/${caseId}/actions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
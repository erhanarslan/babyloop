import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type AdminModerationCaseStatus =
  | "pending"
  | "in_review"
  | "resolved"
  | "dismissed";

export type AdminModerationTargetType = "listing" | "profile" | "message";

export type AdminModerationSort =
  | "newest"
  | "oldest"
  | "updated_desc"
  | "updated_asc";

export type AdminModerationActionType =
  | "note"
  | "review_started"
  | "dismissed"
  | "resolved"
  | "action_taken";

export type AdminModerationCase = {
  id: string;
  status: AdminModerationCaseStatus;
  subjectType: AdminModerationTargetType;
  subjectId: string;
  reason: string;
  details: string | null;
  priority: "low" | "normal" | "high";
  createdAt: string;
  updatedAt: string;
};

export type AdminModerationAction = {
  id: string;
  type?: AdminModerationActionType;
  actionType?: AdminModerationActionType;
  note: string | null;
  adminUserId: string | null;
  adminDisplayName: string | null;
  createdAt: string;
};

export type AdminModerationCaseDetail = AdminModerationCase & {
  actions: AdminModerationAction[];
};

export type ListAdminModerationCasesParams = {
  status?: AdminModerationCaseStatus;
  targetType?: AdminModerationTargetType;
  q?: string;
  sort?: AdminModerationSort;
  limit?: number;
};

export type AdminModerationCasesSummary = {
  total: number;
  byStatus: {
    pending: number;
    inReview: number;
    resolved: number;
    dismissed: number;
  };
  byTargetType: {
    listing: number;
    profile: number;
    message: number;
  };
};

export type ListAdminModerationCasesResponse = {
  cases: AdminModerationCase[];
  summary: AdminModerationCasesSummary;
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

export type AdminSensitiveAccessField = "reporter" | "message";

export type RequestAdminSensitiveAccessInput = {
  reason: string;
  fields: AdminSensitiveAccessField[];
};

export type RequestAdminSensitiveAccessResponse = {
  caseId: string;
  grantedFields: AdminSensitiveAccessField[];
  sensitive: {
    reporter?: {
      profileId: string;
      displayName: string | null;
      email: string | null;
    };
    message?: {
      id: string;
      body: string;
      senderProfileId: string;
      createdAt: string;
    };
  };
  auditEventId: string;
};

type RawAdminTargetPreview =
  | {
      type: "listing";
      id: string;
      title: string;
      status: string;
    }
  | {
      type: "profile";
      id: string;
      displayName: string;
    }
  | {
      type: "message";
      id: string;
      bodyPreview: string;
      createdAt: string;
    };

type RawAdminModerationCase = {
  id: string;
  targetType: AdminModerationTargetType;
  targetId: string;
  status: AdminModerationCaseStatus;
  priority: "low" | "normal" | "high";
  createdAt: string;
  updatedAt: string;
  report: {
    id: string;
    reason: string;
    status: string;
    createdAt: string;
    reporter: {
      redacted: true;
    } | null;
  } | null;
  targetPreview: RawAdminTargetPreview | null;
};

type RawAdminModerationAction = {
  id: string;
  actionType: string;
  note: string | null;
  createdAt: string;
  actorProfile: {
    id: string;
    displayName: string;
  } | null;
};

type RawListAdminModerationCasesResponse = {
  cases: RawAdminModerationCase[];
  summary: AdminModerationCasesSummary;
};

type RawGetAdminModerationCaseResponse = {
  case: RawAdminModerationCase;
  actions: RawAdminModerationAction[];
};

type RawUpdateAdminModerationCaseStatusResponse = {
  caseId: string;
};

type RawCreateAdminModerationCaseActionResponse = {
  action: RawAdminModerationAction;
};

const ADMIN_MODERATION_BASE_PATH = "/api/v1/admin/moderation";

export async function listAdminModerationCases(
  params?: ListAdminModerationCasesParams,
): Promise<ApiResponse<ListAdminModerationCasesResponse>> {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.set("status", params.status);
  }
  if (params?.targetType) {
    searchParams.set("targetType", params.targetType);
  }
  if (params?.q) {
    searchParams.set("q", params.q);
  }
  if (params?.sort) {
    searchParams.set("sort", params.sort);
  }
  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const query = searchParams.toString();
  const path = `${ADMIN_MODERATION_BASE_PATH}/cases${query ? `?${query}` : ""}`;

  const response = await adminRequest<RawListAdminModerationCasesResponse>(path);

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    data: {
      cases: response.data.cases.map(mapModerationCase),
      summary: response.data.summary,
    },
  };
}

export async function getAdminModerationCase(
  caseId: string,
): Promise<ApiResponse<GetAdminModerationCaseResponse>> {
  const response = await adminRequest<RawGetAdminModerationCaseResponse>(
    `${ADMIN_MODERATION_BASE_PATH}/cases/${caseId}`,
  );

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    data: {
      case: {
        ...mapModerationCase(response.data.case),
        actions: response.data.actions.map(mapModerationAction),
      },
    },
  };
}

export async function updateAdminModerationCaseStatus(
  caseId: string,
  input: UpdateAdminModerationCaseStatusInput,
): Promise<ApiResponse<UpdateAdminModerationCaseStatusResponse>> {
  const response = await adminRequest<RawUpdateAdminModerationCaseStatusResponse>(
    `${ADMIN_MODERATION_BASE_PATH}/cases/${caseId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    return response;
  }

  const refreshedCase = await getAdminModerationCase(response.data.caseId);

  if (!refreshedCase.ok) {
    return refreshedCase;
  }

  return {
    ok: true,
    data: {
      case: refreshedCase.data.case,
    },
  };
}

export async function createAdminModerationCaseAction(
  caseId: string,
  input: CreateAdminModerationCaseActionInput,
): Promise<ApiResponse<CreateAdminModerationCaseActionResponse>> {
  const response = await adminRequest<RawCreateAdminModerationCaseActionResponse>(
    `${ADMIN_MODERATION_BASE_PATH}/cases/${caseId}/actions`,
    {
      method: "POST",
      body: JSON.stringify({
        actionType: input.type,
        note: input.note,
      }),
    },
  );

  if (!response.ok) {
    return response;
  }

  const refreshedCase = await getAdminModerationCase(caseId);

  if (!refreshedCase.ok) {
    return refreshedCase;
  }

  return {
    ok: true,
    data: {
      case: refreshedCase.data.case,
    },
  };
}

export async function requestAdminSensitiveAccess(
  caseId: string,
  input: RequestAdminSensitiveAccessInput,
): Promise<ApiResponse<RequestAdminSensitiveAccessResponse>> {
  return adminRequest<RequestAdminSensitiveAccessResponse>(
    `${ADMIN_MODERATION_BASE_PATH}/cases/${caseId}/sensitive-access`,
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

function mapModerationCase(rawCase: RawAdminModerationCase): AdminModerationCase {
  return {
    id: rawCase.id,
    status: rawCase.status,
    subjectType: rawCase.targetType,
    subjectId: rawCase.targetId,
    reason: rawCase.report?.reason ?? "manual_review",
    details: getTargetPreviewText(rawCase.targetPreview),
    priority: rawCase.priority,
    createdAt: rawCase.createdAt,
    updatedAt: rawCase.updatedAt,
  };
}

function mapModerationAction(
  rawAction: RawAdminModerationAction,
): AdminModerationAction {
  return {
    id: rawAction.id,
    actionType: toActionType(rawAction.actionType),
    note: rawAction.note,
    adminUserId: rawAction.actorProfile?.id ?? null,
    adminDisplayName: rawAction.actorProfile?.displayName ?? null,
    createdAt: rawAction.createdAt,
  };
}

function getTargetPreviewText(preview: RawAdminTargetPreview | null): string | null {
  if (!preview) {
    return null;
  }

  if (preview.type === "listing") {
    return `Listing: ${preview.title} (${preview.status})`;
  }

  if (preview.type === "profile") {
    return `Profile: ${preview.displayName}`;
  }

  return `Message preview: ${preview.bodyPreview}`;
}

function toActionType(value: string): AdminModerationActionType {
  if (
    value === "note" ||
    value === "review_started" ||
    value === "dismissed" ||
    value === "resolved" ||
    value === "action_taken"
  ) {
    return value;
  }

  return "note";
}

/**
 * Compatibility aliases for the current backoffice moderation components.
 * TODO: Rename components to AdminModeration* after the moderation contract is stable.
 */
export type BackofficeModerationCaseStatus = AdminModerationCaseStatus;
export type BackofficeModerationActionType = AdminModerationActionType;
export type BackofficeModerationCase = AdminModerationCase;
export type BackofficeModerationAction = AdminModerationAction;
export type BackofficeModerationCaseDetail = AdminModerationCaseDetail;

export const listBackofficeModerationCases = listAdminModerationCases;
export const getBackofficeModerationCase = getAdminModerationCase;
export const updateBackofficeModerationCaseStatus =
  updateAdminModerationCaseStatus;
export const createBackofficeModerationCaseAction =
  createAdminModerationCaseAction;

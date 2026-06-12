import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type AdminAiOpsStatus =
  | "success"
  | "error"
  | "validation_failed"
  | "provider_failed"
  | "skipped";

export type AdminAiOpsRunSummary = {
  id: string;
  feature: string;
  providerName: string;
  modelName: string | null;
  promptVersion: string;
  status: AdminAiOpsStatus;
  caseId: string | null;
  confidenceScore: number | null;
  riskScore: number | null;
  errorSummary: string | null;
  createdAt: string;
};

export type AdminAiOpsSummary = {
  totals: {
    totalRuns: number;
    runsLast24Hours: number;
    runsLast7Days: number;
    successRunsLast7Days: number;
    failedRunsLast7Days: number;
    providerFailuresLast7Days: number;
    validationFailuresLast7Days: number;
    skippedRunsLast7Days: number;
  };
  statusCounts: Array<{
    status: AdminAiOpsStatus;
    count: number;
  }>;
  providerModelCounts: Array<{
    providerName: string;
    modelName: string | null;
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
  }>;
  recentRuns: AdminAiOpsRunSummary[];
};

export type AdminAiOpsRunsParams = {
  feature?: string;
  providerName?: string;
  status?: AdminAiOpsStatus;
  q?: string;
  sort?: "newest" | "oldest";
  limit?: number;
};

export type GetAdminAiOpsSummaryResponse = {
  summary: AdminAiOpsSummary;
};

export type ListAdminAiOpsRunsResponse = {
  runs: AdminAiOpsRunSummary[];
};

export async function getAdminAiOpsSummary(): Promise<
  ApiResponse<GetAdminAiOpsSummaryResponse>
> {
  return adminRequest<GetAdminAiOpsSummaryResponse>("/api/v1/admin/ai-ops/summary");
}

export async function listAdminAiOpsRuns(
  params?: AdminAiOpsRunsParams,
): Promise<ApiResponse<ListAdminAiOpsRunsResponse>> {
  const searchParams = new URLSearchParams();

  if (params?.feature) {
    searchParams.set("feature", params.feature);
  }
  if (params?.providerName) {
    searchParams.set("providerName", params.providerName);
  }
  if (params?.status) {
    searchParams.set("status", params.status);
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

  return adminRequest<ListAdminAiOpsRunsResponse>(
    `/api/v1/admin/ai-ops/runs${query ? `?${query}` : ""}`,
  );
}

async function adminRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const response = await authFetch(getApiBaseUrl(), path, init);

    return (await response.json()) as ApiResponse<T>;
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

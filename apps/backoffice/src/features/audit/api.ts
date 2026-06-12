import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type AdminAuditSort = "newest" | "oldest";

export type AdminAuditEvent = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorProfileId: string | null;
  createdAt: string;
  metadata: Record<string, string | number | boolean | string[] | null>;
};

export type ListAdminAuditEventsParams = {
  actorProfileId?: string;
  entityType?: string;
  eventType?: string;
  q?: string;
  sort?: AdminAuditSort;
  limit?: number;
};

export type ListAdminAuditEventsResponse = {
  events: AdminAuditEvent[];
};

export async function listAdminAuditEvents(
  params?: ListAdminAuditEventsParams,
): Promise<ApiResponse<ListAdminAuditEventsResponse>> {
  const searchParams = new URLSearchParams();

  if (params?.actorProfileId) {
    searchParams.set("actorProfileId", params.actorProfileId);
  }
  if (params?.entityType) {
    searchParams.set("entityType", params.entityType);
  }
  if (params?.eventType) {
    searchParams.set("eventType", params.eventType);
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
  const path = `/api/v1/admin/audit/events${query ? `?${query}` : ""}`;

  try {
    const response = await authFetch(getApiBaseUrl(), path);

    return (await response.json()) as ApiResponse<ListAdminAuditEventsResponse>;
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

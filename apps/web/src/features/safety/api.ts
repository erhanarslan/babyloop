"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authFetch } from "../../lib/auth-client";

export type ReportReason =
  | "safety"
  | "scam"
  | "inappropriate"
  | "prohibited_item"
  | "harassment"
  | "other";

export type ReportRequest = {
  reason: ReportReason;
  details?: string;
};

export type ReportPayload = {
  report: {
    id: string;
    targetType: "listing" | "profile" | "message";
    targetId: string;
    status: string;
    created: boolean;
  };
};

export type BlockedProfile = {
  id: string;
  displayName: string;
  blockedAt: string;
};

export async function reportListing(
  apiBaseUrl: string,
  listingId: string,
  payload: ReportRequest
): Promise<ApiResponse<ReportPayload>> {
  return postReport(apiBaseUrl, `/api/v1/reports/listings/${listingId}`, payload);
}

export async function reportProfile(
  apiBaseUrl: string,
  profileId: string,
  payload: ReportRequest
): Promise<ApiResponse<ReportPayload>> {
  return postReport(apiBaseUrl, `/api/v1/reports/profiles/${profileId}`, payload);
}

export async function reportMessage(
  apiBaseUrl: string,
  messageId: string,
  payload: ReportRequest
): Promise<ApiResponse<ReportPayload>> {
  return postReport(apiBaseUrl, `/api/v1/reports/messages/${messageId}`, payload);
}

export async function blockProfile(
  apiBaseUrl: string,
  profileId: string
): Promise<ApiResponse<{ blockedProfile: BlockedProfile; created: boolean }>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/profiles/${profileId}/block`, {
    method: "POST"
  });

  return response.json() as Promise<ApiResponse<{ blockedProfile: BlockedProfile; created: boolean }>>;
}

export async function unblockProfile(
  apiBaseUrl: string,
  profileId: string
): Promise<ApiResponse<{ removed: boolean }>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/profiles/${profileId}/block`, {
    method: "DELETE"
  });

  return response.json() as Promise<ApiResponse<{ removed: boolean }>>;
}

export async function fetchBlockedProfiles(
  apiBaseUrl: string
): Promise<ApiResponse<{ blockedProfiles: BlockedProfile[] }>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/profiles/blocked");

  return response.json() as Promise<ApiResponse<{ blockedProfiles: BlockedProfile[] }>>;
}

async function postReport(
  apiBaseUrl: string,
  path: string,
  payload: ReportRequest
): Promise<ApiResponse<ReportPayload>> {
  const response = await authFetch(apiBaseUrl, path, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response.json() as Promise<ApiResponse<ReportPayload>>;
}

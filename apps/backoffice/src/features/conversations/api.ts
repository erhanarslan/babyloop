import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type AdminConversationSort = "latest_desc" | "latest_asc" | "newest" | "oldest";
export type AdminConversationStatus = "active";
export type AdminProfileSafetyStatus = "active" | "restricted" | "suspended";

export type AdminConversationProfileSummary = {
  profileId: string;
  displayName: string;
  safetyStatus: AdminProfileSafetyStatus;
};

export type AdminConversationListingSummary = {
  listingId: string;
  title: string;
  status: string;
};

export type AdminConversationMessagePreview = {
  messageId: string;
  senderProfileId: string;
  bodyPreview: string;
  isHidden: boolean;
  createdAt: string;
};

export type AdminConversationSummary = {
  conversationId: string;
  status: string;
  participants: [AdminConversationProfileSummary, AdminConversationProfileSummary];
  contextListing: AdminConversationListingSummary | null;
  latestMessage: AdminConversationMessagePreview | null;
  messageCount: number;
  reportedMessageCount: number;
  openCaseCount: number;
  enforcementCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminConversationMessageSummary = {
  messageId: string;
  sender: AdminConversationProfileSummary;
  bodyPreview: string;
  isHidden: boolean;
  reportCount: number;
  openCaseCount: number;
  enforcementCount: number;
  createdAt: string;
};

export type AdminConversationCaseSummary = {
  caseId: string;
  reportId: string | null;
  targetType: "message";
  targetId: string;
  status: "pending" | "in_review" | "resolved" | "dismissed";
  priority: "low" | "normal" | "high";
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminConversationEnforcementSummary = {
  actionId: string;
  caseId: string | null;
  messageId: string | null;
  actionType: string;
  createdAt: string;
};

export type AdminConversationDetail = AdminConversationSummary & {
  messages: AdminConversationMessageSummary[];
  relatedModerationCases: AdminConversationCaseSummary[];
  enforcementHistory: AdminConversationEnforcementSummary[];
};

export type ListAdminConversationsParams = {
  status?: AdminConversationStatus;
  q?: string;
  sort?: AdminConversationSort;
  limit?: number;
};

export type ListAdminConversationsResponse = {
  conversations: AdminConversationSummary[];
};

export type GetAdminConversationResponse = {
  conversation: AdminConversationDetail;
};

const ADMIN_CONVERSATIONS_BASE_PATH = "/api/v1/admin/conversations";

export async function listAdminConversations(
  params?: ListAdminConversationsParams,
): Promise<ApiResponse<ListAdminConversationsResponse>> {
  const searchParams = new URLSearchParams();

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
  return adminRequest<ListAdminConversationsResponse>(
    `${ADMIN_CONVERSATIONS_BASE_PATH}${query ? `?${query}` : ""}`,
  );
}

export async function getAdminConversation(
  conversationId: string,
): Promise<ApiResponse<GetAdminConversationResponse>> {
  return adminRequest<GetAdminConversationResponse>(
    `${ADMIN_CONVERSATIONS_BASE_PATH}/${conversationId}`,
  );
}

async function adminRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const response = await authFetch(getApiBaseUrl(), path, init);

  return response.json() as Promise<ApiResponse<T>>;
}

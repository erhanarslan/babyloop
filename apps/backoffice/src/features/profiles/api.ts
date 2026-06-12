import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type AdminProfileSafetyStatus = "active" | "restricted" | "suspended";
export type AdminProfileRiskLevel = "low" | "medium" | "high" | "critical";
export type AdminProfileSort =
  | "risk_desc"
  | "risk_asc"
  | "trust_desc"
  | "trust_asc"
  | "newest"
  | "oldest";

export type AdminProfileTrustSnapshot = {
  profileId: string;
  trustScore: number;
  riskScore: number;
  riskLevel: AdminProfileRiskLevel;
  safetyStatus: AdminProfileSafetyStatus;
  openCaseCount: number;
  totalCaseCount: number;
  recentReportCount: number;
  recentEnforcementCount: number;
  sensitiveAccessCount: number;
  aiSummaryCount: number;
  lastReportAt: string | null;
  lastEnforcementAt: string | null;
  computedAt: string;
};

export type AdminProfileSummary = {
  profileId: string;
  displayName: string;
  locationCity: string | null;
  safetyStatus: AdminProfileSafetyStatus;
  createdAt: string;
  updatedAt: string;
  listingCount: number;
  trustSnapshot: AdminProfileTrustSnapshot | null;
};

export type AdminProfileListingSummary = {
  listingId: string;
  title: string;
  status: string;
  listingType: string;
  condition: string;
  price: {
    amount: string;
    currency: string;
  } | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type AdminProfileModerationCaseSummary = {
  caseId: string;
  reportId: string | null;
  targetType: "listing" | "profile" | "message";
  targetId: string;
  status: "pending" | "in_review" | "resolved" | "dismissed";
  priority: "low" | "normal" | "high";
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminProfileEnforcementSummary = {
  actionId: string;
  caseId: string | null;
  actionType: string;
  createdAt: string;
};

export type AdminProfileDetail = AdminProfileSummary & {
  stats: {
    totalListings: number;
    activeListings: number;
    archivedListings: number;
    soldListings: number;
    reservedListings: number;
    draftListings: number;
    totalCases: number;
    openCases: number;
    enforcementActions: number;
  };
  listings: AdminProfileListingSummary[];
  relatedModerationCases: AdminProfileModerationCaseSummary[];
  enforcementHistory: AdminProfileEnforcementSummary[];
};

export type ListAdminProfilesParams = {
  safetyStatus?: AdminProfileSafetyStatus;
  riskLevel?: AdminProfileRiskLevel;
  q?: string;
  sort?: AdminProfileSort;
  limit?: number;
};

export type ListAdminProfilesResponse = {
  profiles: AdminProfileSummary[];
};

export type GetAdminProfileResponse = {
  profile: AdminProfileDetail;
};

const ADMIN_PROFILES_BASE_PATH = "/api/v1/admin/profiles";

export async function listAdminProfiles(
  params?: ListAdminProfilesParams,
): Promise<ApiResponse<ListAdminProfilesResponse>> {
  const searchParams = new URLSearchParams();

  if (params?.safetyStatus) {
    searchParams.set("safetyStatus", params.safetyStatus);
  }
  if (params?.riskLevel) {
    searchParams.set("riskLevel", params.riskLevel);
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
  const path = `${ADMIN_PROFILES_BASE_PATH}${query ? `?${query}` : ""}`;

  return adminRequest<ListAdminProfilesResponse>(path);
}

export async function getAdminProfile(
  profileId: string,
): Promise<ApiResponse<GetAdminProfileResponse>> {
  return adminRequest<GetAdminProfileResponse>(`${ADMIN_PROFILES_BASE_PATH}/${profileId}`);
}

async function adminRequest<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await authFetch(getApiBaseUrl(), path, init);

  return response.json() as Promise<ApiResponse<T>>;
}

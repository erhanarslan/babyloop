import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type BackofficeAnalyticsOverview = {
  totalRegisteredUsers: number;
  verifiedUsers: number;
  verifiedRate: number;
  googleLinkedUsers: number;
  googleLinkedRate: number;
  passwordUsers: number;
  dau: number;
  activeUsers: number;
  sessions: number;
  averageSessionEngagementMs: number;
  pageViews: number;
  screenViews: number;
  listingViews: number;
  uniqueListingViewers: number;
  favoriteUsers: number;
  chatUsers: number;
  messageSenders: number;
  conversationsStarted: number;
  assistantUsers: number;
  checkoutUsers: number;
  lastRollupAt: string | null;
};

export type BackofficeAnalyticsPageRow = {
  surface: string;
  platform: string;
  views: number;
  uniqueUsers: number;
  uniqueSessions: number;
  averageEngagementMs: number;
  p50EngagementMs: number;
  p90EngagementMs: number;
  exits: number;
};

export type BackofficeAnalyticsSection = {
  title: string;
  metrics: Array<{
    label: string;
    unit?: "count" | "percent" | "milliseconds";
    value: number;
  }>;
};

export type BackofficeAnalyticsCategoryRow = {
  categoryId: string;
  categoryName: string;
  platform: string;
  impressions: number;
  listingViews: number;
  uniqueViewers: number;
  favorites: number;
  conversationsStarted: number;
  cartAdds: number;
  checkoutCompleted: number;
};

export type BackofficeAnalyticsAuthRow = {
  approvalCompletions: number;
  authProvider: string;
  emailVerifications: number;
  failedLogins: number;
  mfaCompletions: number;
  platform: string;
  registrations: number;
  successfulLogins: number;
};

export type BackofficeAnalyticsDataQuality = {
  duplicateEventsLast7Days: number;
  rejectedEventsLast7Days: number;
  missingSessionIdsLast7Days: number;
  unknownEventVersionsLast7Days: number;
  rawEventsLast7Days: number;
};

export type BackofficeAnalyticsFunnel = {
  name: string;
  steps: Array<{
    label: string;
    users: number;
  }>;
};

export async function getBackofficeAnalyticsOverview(): Promise<ApiResponse<{
  overview: BackofficeAnalyticsOverview;
}>> {
  return getAnalyticsApiResponse("/api/v1/admin/analytics/overview");
}

export async function getBackofficeAnalyticsPages(): Promise<ApiResponse<{
  pages: BackofficeAnalyticsPageRow[];
}>> {
  return getAnalyticsApiResponse("/api/v1/admin/analytics/pages");
}

export async function getBackofficeAnalyticsSection(path: string): Promise<ApiResponse<{
  section: BackofficeAnalyticsSection;
}>> {
  return getAnalyticsApiResponse(`/api/v1/admin/analytics/${path}`);
}

export async function getBackofficeAnalyticsEngagement(): Promise<ApiResponse<{
  engagement: {
    pages: BackofficeAnalyticsPageRow[];
    summary: BackofficeAnalyticsSection;
  };
}>> {
  return getAnalyticsApiResponse("/api/v1/admin/analytics/engagement");
}

export async function getBackofficeAnalyticsMarketplace(): Promise<ApiResponse<{
  marketplace: {
    categories: BackofficeAnalyticsCategoryRow[];
    summary: BackofficeAnalyticsSection;
  };
}>> {
  return getAnalyticsApiResponse("/api/v1/admin/analytics/marketplace");
}

export async function getBackofficeAnalyticsFunnels(): Promise<ApiResponse<{
  funnels: BackofficeAnalyticsFunnel[];
}>> {
  return getAnalyticsApiResponse("/api/v1/admin/analytics/funnels");
}

export async function getBackofficeAnalyticsAuth(): Promise<ApiResponse<{
  auth: BackofficeAnalyticsAuthRow[];
}>> {
  return getAnalyticsApiResponse("/api/v1/admin/analytics/auth");
}

export async function getBackofficeAnalyticsDataQuality(): Promise<ApiResponse<{
  dataQuality: BackofficeAnalyticsDataQuality;
}>> {
  return getAnalyticsApiResponse("/api/v1/admin/analytics/data-quality");
}

async function getAnalyticsApiResponse<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const response = await authFetch(getApiBaseUrl(), path);
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return {
      ok: false,
      error: {
        code: "BACKOFFICE_REQUEST_FAILED",
        message: "Backoffice request failed."
      }
    };
  }
}

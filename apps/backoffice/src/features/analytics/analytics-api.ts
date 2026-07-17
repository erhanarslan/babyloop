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

import type { ApiResponse } from "@babyloop/shared";

import { getApiBaseUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth-client";

export type AdminProductAnalyticsEventName =
  | "listing_detail_viewed"
  | "listing_card_clicked"
  | "contact_seller_intent"
  | "recently_viewed_listing_clicked"
  | "category_viewed"
  | "search_performed";

export type AdminProductAnalyticsSummary = {
  totals: {
    totalEvents: number;
    eventsLast24Hours: number;
    eventsLast7Days: number;
    listingDetailViewsLast7Days: number;
    categoryViewsLast7Days: number;
    searchesLast7Days: number;
    recentlyViewedClicksLast7Days: number;
  };
  eventCounts: Array<{
    eventType: AdminProductAnalyticsEventName;
    count: number;
  }>;
  sourceCounts: Array<{
    source: string;
    count: number;
  }>;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    viewCount: number;
  }>;
  topListings: Array<{
    listingId: string;
    title: string;
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    eventCount: number;
  }>;
  searchResultBuckets: Array<{
    resultBucket: string;
    count: number;
  }>;
};

export type GetAdminProductAnalyticsSummaryResponse = {
  summary: AdminProductAnalyticsSummary;
};

export async function getAdminProductAnalyticsSummary(): Promise<
  ApiResponse<GetAdminProductAnalyticsSummaryResponse>
> {
  try {
    const response = await authFetch(
      getApiBaseUrl(),
      "/api/v1/admin/product-analytics/summary",
    );

    return (await response.json()) as ApiResponse<GetAdminProductAnalyticsSummaryResponse>;
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
